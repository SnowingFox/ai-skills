import { getDb } from '@/db';
import { runBundledMigrations } from '@/db/run-migrations';
import { ADMIN_DB_COOKIE, verifyAdminToken } from '@/lib/admin-auth';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_DB_COOKIE)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getDb();
    const result = await runBundledMigrations(db);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[admin/migrate]', error);
    return NextResponse.json(
      {
        error: 'Migration failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
