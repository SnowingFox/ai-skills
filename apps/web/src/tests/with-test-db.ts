import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';

// Tests use a dedicated database to avoid leaking real sync data into
// integration tests. Each test still runs inside a transaction that rolls
// back, so this database stays clean between runs.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://postgres:root@localhost:5432/ai-skills-test';

/**
 * Run a test callback inside a transaction that is always rolled back.
 * Each test gets a clean slate without polluting the shared database.
 */
export async function withTestDb<T>(
  fn: (db: ReturnType<typeof drizzle<typeof schema>>) => Promise<T>
): Promise<T> {
  const sql = postgres(TEST_DATABASE_URL, { max: 1 });
  const db = drizzle(sql, { schema });

  try {
    return await db.transaction(async (tx) => {
      const result = await fn(tx as unknown as typeof db);
      // Always rollback — the throw is the mechanism, not an error
      throw { __rollback: true, result };
    });
  } catch (e: unknown) {
    if (
      e &&
      typeof e === 'object' &&
      '__rollback' in e &&
      (e as { __rollback: boolean }).__rollback
    ) {
      return (e as { result: T }).result;
    }
    throw e;
  } finally {
    await sql.end();
  }
}
