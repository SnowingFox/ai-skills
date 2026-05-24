import {
  ADMIN_DB_COOKIE,
  adminCookieOptions,
  signAdminToken,
  verifyAdminToken,
} from '@/lib/admin-auth';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { password } = (await req.json()) as { password?: string };
  const expected = process.env.ADMIN_DB_PASSWORD;

  if (!expected) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    );
  }

  if (!password || password !== expected) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const token = await signAdminToken();
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_DB_COOKIE, token, adminCookieOptions());

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_DB_COOKIE);
  return NextResponse.json({ success: true });
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_DB_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  const payload = await verifyAdminToken(token);
  return NextResponse.json({ authenticated: payload !== null });
}
