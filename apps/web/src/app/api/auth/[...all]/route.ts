import { createAuth } from '@/lib/auth';

/**
 * Better Auth API handlers for Cloudflare Workers
 *
 * ⚠️ IMPORTANT: We create auth instance per request because:
 * 1. Hyperdrive binding (env.HYPERDRIVE) is only available in request context
 * 2. This is the standard pattern for Cloudflare Workers + serverless environments
 * 3. Connection pooling is handled by Hyperdrive at the edge layer
 *
 * Note: We cannot use toNextJsHandler(auth) pattern because auth needs to be
 * created per-request, not at module level.
 */

export async function POST(req: Request) {
  const auth = await createAuth();
  return auth.handler(req);
}

export async function GET(req: Request) {
  const auth = await createAuth();
  return auth.handler(req);
}
