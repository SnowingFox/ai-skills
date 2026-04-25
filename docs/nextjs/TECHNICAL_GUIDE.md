# Cloudflare Workers + Next.js + Better Auth 集成指南

## 📋 文档概述

本文档记录在 Cloudflare Workers 环境中集成 Better Auth 和 Hyperdrive 时遇到的 Worker 挂起问题及解决方案。

**技术栈**：
- Next.js 16 + OpenNext.js Cloudflare
- Better Auth 1.4.17 + Drizzle ORM
- PostgreSQL + Cloudflare Hyperdrive
- Cloudflare Workers Runtime

---

## 🎯 目录

1. [问题现象](#问题现象)
2. [根本原因](#根本原因)
3. [解决方案](#解决方案)
4. [实施步骤](#实施步骤)
5. [最佳实践](#最佳实践)
6. [参考资料](#参考资料)

---

## 问题现象

Google 登录后访问回调 URL 时报错：

```
Error: The Workers runtime canceled this request because it detected
that your Worker's code had hung and would never generate a response.
```

---

## 根本原因

### 核心问题：Top-Level Await 导致 Worker 挂起

问题本质是 **模块加载时使用 top-level await 访问 Cloudflare context**，而 context 只在请求时才可用。

### 问题代码

```typescript
// src/lib/auth.ts - ❌ 错误
export const auth = betterAuth({
  database: drizzleAdapter(await getDb(), { provider: 'pg' }), // 💥 Top-level await
});

// src/db/index.ts - ❌ 错误
export async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  // 模块加载时 context 不存在，Promise 永远等待
  return drizzle(postgres(env.HYPERDRIVE.connectionString));
}
```

### 为什么会挂起？

Cloudflare Workers 生命周期：

| 阶段 | Request Context | Env Bindings |
|------|----------------|--------------|
| **模块初始化** (Worker 启动) | ❌ 不存在 | ❌ 不可用 |
| **请求处理** (HTTP 请求到达) | ✅ 存在 | ✅ 可用 |

**执行流程**：
```
Worker 启动 → 导入 auth.ts → 执行 await getDb()
→ 访问 context (❌ 不存在) → Promise 永远等待 → Worker 挂起
```

---

## 解决方案

### 核心思路

将资源从"模块级全局单例"改为"请求级工厂函数"。

> **原则**：任何依赖 env / bindings 的资源，只能在 request handler 内创建

### 解决方案对比

| 方面 | 问题代码 | 解决方案 |
|------|---------|---------|
| 初始化时机 | 模块加载时 | 请求处理时 |
| auth 模式 | 全局单例 | 工厂函数 |
| db 缓存 | 全局变量 | React cache() |
| top-level await | 有 | 无 |

### 关键改进

#### 1. 数据库连接

```typescript
// src/db/index.ts
import { cache } from 'react';

// ✅ 使用 React cache() 实现请求级缓存
export const getDb = cache(async () => {
  const { env } = await getCloudflareContext({ async: true });
  const sql = postgres(env.HYPERDRIVE.connectionString, {
    max: 5,              // 限制连接数
    fetch_types: false,  // 性能优化
  });
  return drizzle(sql, { schema });
});
```

#### 2. Better Auth 工厂函数

```typescript
// src/lib/auth.ts
// ✅ 请求级创建
export async function createAuth() {
  const db = await getDb();
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg' }),
    // ... 其他配置
  });
}
```

#### 3. API Route

```typescript
// src/app/api/auth/[...all]/route.ts
import { createAuth } from '@/lib/auth';

export async function POST(req: Request) {
  const auth = await createAuth();
  return auth.handler(req);
}

export async function GET(req: Request) {
  const auth = await createAuth();
  return auth.handler(req);
}
```

#### 4. 类型推断

```typescript
// src/lib/auth-types.ts
import type { createAuth } from './auth';

type Auth = Awaited<ReturnType<typeof createAuth>>;

export type Session = Auth['$Infer']['Session'];
export type User = Auth['$Infer']['Session']['user'];
```

---

## 实施步骤

### 修改文件清单

#### 1. `src/db/index.ts` - 数据库连接
```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { cache } from 'react';
import * as schema from './schema';

export const getDb = cache(async () => {
  const { env } = await getCloudflareContext({ async: true });
  const sql = postgres(env.HYPERDRIVE.connectionString, {
    max: 5,
    fetch_types: false,
  });
  return drizzle(sql, { schema });
});
```

#### 2. `src/lib/auth.ts` - Better Auth
```typescript
export async function createAuth() {
  const db = await getDb();
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg' }),
    // ... 其他配置不变
  });
}
```

#### 3. `src/app/api/auth/[...all]/route.ts` - API Route
```typescript
import { createAuth } from '@/lib/auth';

export async function POST(req: Request) {
  const auth = await createAuth();
  return auth.handler(req);
}

export async function GET(req: Request) {
  const auth = await createAuth();
  return auth.handler(req);
}
```

#### 4. `src/lib/server.ts` + `src/lib/require-session.ts` - 辅助函数
```typescript
// 内部改用 createAuth()，对外 API 不变
export const getSession = cache(async () => {
  const auth = await createAuth();
  return await auth.api.getSession({ headers: await headers() });
});
```

#### 5. `src/lib/auth-types.ts` - 类型推断
```typescript
import type { createAuth } from './auth';
type Auth = Awaited<ReturnType<typeof createAuth>>;
export type Session = Auth['$Infer']['Session'];
export type User = Auth['$Infer']['Session']['user'];
```

#### 6. 业务代码 - 无需修改
所有使用 `getSession()`、`requireSession()`、`await getDb()` 的代码保持不变。

---

## 最佳实践

### 核心原则

> **在 Cloudflare Workers 中，任何依赖 env / bindings 的资源，只能在 request handler 内创建**

#### ❌ 永远不要

```typescript
// ❌ 模块顶层初始化
export const db = await getDb();
export const auth = betterAuth({...});
```

#### ✅ 正确做法

```typescript
// ✅ 工厂函数 + React cache()
export const getDb = cache(async () => {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(postgres(env.HYPERDRIVE.connectionString));
});

export async function createAuth() {
  const db = await getDb();
  return betterAuth({ database: drizzleAdapter(db) });
}
```

### 性能优化

#### postgres.js 推荐配置

```typescript
postgres(connectionString, {
  max: 5,              // Cloudflare Workers 最多 6 个并发连接
  fetch_types: false,  // 跳过类型获取（减少往返）
});
```

### React cache() 的作用

- 单请求内缓存函数结果
- 避免重复创建资源
- 请求结束自动清理

```typescript
export const getDb = cache(async () => {
  // 同一请求多次调用，只执行一次
});
```

---

## 参考资料

以下是解决此问题实际参考的官方文档：

- [Cloudflare Hyperdrive + Drizzle ORM 集成示例](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/drizzle-orm/)
- [OpenNext.js Cloudflare 数据库集成指南](https://opennext.js.org/cloudflare/howtos/db)

---

## 总结

通过将资源从"模块级全局单例"改为"请求级工厂函数"，完全解决了 Cloudflare Workers 环境中的 top-level await 挂起问题。

**解决方案特点**：
- ✅ 符合 Cloudflare Workers 最佳实践
- ✅ 遵循 OpenNext.js 官方推荐架构
- ✅ 对现有业务代码改动最小
- ✅ 生产级、可扩展、行业标准

---

**文档版本**: 1.0.0
**最后更新**: 2026-01-28
**实际测试**: 通过 ✅
