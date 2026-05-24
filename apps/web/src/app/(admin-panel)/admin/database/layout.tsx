import { isAdminAuthenticated } from '@/lib/admin-auth';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

export default async function DatabaseLayout({
  children,
}: {
  children: ReactNode;
}) {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect('/admin/login');
  }

  return <>{children}</>;
}
