import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export const ADMIN_DB_COOKIE = 'admin-db-token';
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

function getSecret() {
  const pw = process.env.ADMIN_DB_PASSWORD;
  if (!pw) throw new Error('ADMIN_DB_PASSWORD is not set');
  return new TextEncoder().encode(`${pw}__admin-db-secret`);
}

export async function signAdminToken() {
  return new SignJWT({ role: 'admin-db' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecret());
}

export async function verifyAdminToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload;
  } catch {
    return null;
  }
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  };
}

/**
 * Server Component helper: returns true if the request carries a valid
 * admin-db JWT cookie.
 */
export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_DB_COOKIE)?.value;
  if (!token) return false;
  return (await verifyAdminToken(token)) !== null;
}
