import { getDb } from '@/db';
import { ADMIN_DB_COOKIE, verifyAdminToken } from '@/lib/admin-auth';
import { sql } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_DB_COOKIE)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();

  const tables = await db.execute(sql`
    SELECT
      t.table_name,
      COALESCE(
        (SELECT reltuples::bigint FROM pg_class WHERE relname = t.table_name),
        0
      ) AS row_estimate
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name
  `) as unknown as { table_name: string; row_estimate: string }[];

  return NextResponse.json({
    tables: tables.map((t) => ({
      name: t.table_name,
      rowEstimate: Number(t.row_estimate),
    })),
  });
}
