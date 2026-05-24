import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { withTestDb } from '@/tests/with-test-db';

describe('test infrastructure', () => {
  it('connects to the database and runs a query', async () => {
    await withTestDb(async (db) => {
      const rows = await db.execute(sql`SELECT 1 AS ok`);
      expect(rows).toHaveLength(1);
    });
  });

  it('rolls back writes between tests', async () => {
    const tableName = `_smoke_test_${Date.now()}`;

    await withTestDb(async (db) => {
      await db.execute(
        sql.raw(`CREATE TEMP TABLE ${tableName} (id serial PRIMARY KEY)`)
      );
      await db.execute(sql.raw(`INSERT INTO ${tableName} DEFAULT VALUES`));
      const rows = await db.execute(
        sql.raw(`SELECT count(*)::int AS c FROM ${tableName}`)
      );
      expect(rows[0].c).toBe(1);
    });
  });
});
