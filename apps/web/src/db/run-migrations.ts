import { bundledMigrations } from '@/db/migrations.bundle';
import type { getDb } from '@/db';
import { sql } from 'drizzle-orm';

async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function splitStatements(migrationSql: string) {
  return migrationSql
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

/**
 * Applies bundled Drizzle SQL migrations through Hyperdrive. Safe to call
 * multiple times — already-applied migrations are skipped via
 * __drizzle_migrations.
 */
export async function runBundledMigrations(db: Awaited<ReturnType<typeof getDb>>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const migration of bundledMigrations) {
    const hash = await sha256(migration.sql);
    const existing = await db.execute(sql`
      SELECT id FROM "__drizzle_migrations" WHERE hash = ${hash} LIMIT 1
    `);
    const rows = Array.from(existing as Iterable<{ id: number }>);

    if (rows.length > 0) {
      skipped.push(migration.tag);
      continue;
    }

    for (const statement of splitStatements(migration.sql)) {
      await db.execute(sql.raw(statement));
    }

    await db.execute(sql`
      INSERT INTO "__drizzle_migrations" (hash, created_at)
      VALUES (${hash}, ${migration.when})
    `);
    applied.push(migration.tag);
  }

  return { applied, skipped };
}
