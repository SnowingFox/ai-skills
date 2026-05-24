import { RegistryHeader } from '@/components/layout/registry-header';
import type { ReactNode } from 'react';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <RegistryHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
