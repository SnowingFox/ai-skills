import { getDb } from '@/db';
import { ADMIN_DB_COOKIE, verifyAdminToken } from '@/lib/admin-auth';
import { sql } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface ColumnRow {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

async function validateTableName(
  db: Awaited<ReturnType<typeof getDb>>,
  name: string
) {
  const result = (await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name = ${name}
  `)) as unknown as { table_name: string }[];
  return result.length > 0;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_DB_COOKIE)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { table } = await params;
  const db = await getDb();

  const valid = await validateTableName(db, table);
  if (!valid) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 });
  }

  const searchParams = req.nextUrl.searchParams;
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get('pageSize') ?? '20'))
  );
  const sortCol = searchParams.get('sort');
  const sortOrder = searchParams.get('order') === 'desc' ? 'DESC' : 'ASC';
  const offset = (page - 1) * pageSize;

  const columns = (await db.execute(sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
    ORDER BY ordinal_position
  `)) as unknown as ColumnRow[];

  const columnNames = columns.map((c) => c.column_name);

  let orderClause = sql`1`;
  if (sortCol && columnNames.includes(sortCol)) {
    orderClause =
      sortOrder === 'DESC'
        ? sql`${sql.identifier(sortCol)} DESC`
        : sql`${sql.identifier(sortCol)} ASC`;
  }

  const [rows, countResult] = await Promise.all([
    db.execute(
      sql`SELECT * FROM ${sql.identifier(table)} ORDER BY ${orderClause} LIMIT ${pageSize} OFFSET ${offset}`
    ) as Promise<unknown> as Promise<Record<string, unknown>[]>,
    db.execute(
      sql`SELECT count(*)::text AS count FROM ${sql.identifier(table)}`
    ) as Promise<unknown> as Promise<{ count: string }[]>,
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  return NextResponse.json({
    columns: columns.map((c) => ({
      name: c.column_name,
      type: c.data_type,
      nullable: c.is_nullable === 'YES',
      default: c.column_default,
    })),
    rows,
    total,
    page,
    pageSize,
  });
}
