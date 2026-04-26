'use client';

import { LoginWrapper } from '@/components/auth/login-wrapper';
import { ModeSwitcher } from '@/components/layout/mode-switcher';
import { UserButton } from '@/components/layout/user-button';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LocaleLink, useLocalePathname } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { Routes } from '@/routes';
import { TriangleIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface NavItem {
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Browse', href: Routes.Root },
  { label: 'Pricing', href: Routes.Pricing },
  { label: 'About', href: Routes.About },
];

export function SiteHeader() {
  const t = useTranslations();
  const pathname = useLocalePathname();
  const [mounted, setMounted] = useState(false);
  const { data: session, isPending } = authClient.useSession();
  const currentUser = session?.user;

  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <LocaleLink
            href={Routes.Root}
            aria-label="Home"
            className="flex items-center gap-2 rounded outline-none focus-visible:outline-focus"
          >
            <TriangleIcon className="size-4 fill-foreground text-foreground" />
            <span className="text-base font-medium tracking-tight">
              {t('Metadata.name')}
            </span>
          </LocaleLink>
        </div>

        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === Routes.Root
                ? pathname === '/'
                : pathname.startsWith(item.href);
            return (
              <LocaleLink
                key={item.href}
                href={item.href}
                className={cn(
                  'text-sm text-muted-foreground transition-colors hover:text-foreground',
                  isActive && 'text-foreground'
                )}
              >
                {item.label}
              </LocaleLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ModeSwitcher />
          {!mounted || isPending ? (
            <Skeleton className="size-8 rounded-full" />
          ) : currentUser ? (
            <UserButton user={currentUser} />
          ) : (
            <>
              <LoginWrapper mode="modal" asChild>
                <Button type="button" variant="ghost" size="sm">
                  {t('Common.login')}
                </Button>
              </LoginWrapper>
              <LocaleLink
                href={Routes.Register}
                className={buttonVariants({ size: 'sm' })}
              >
                {t('Common.signUp')}
              </LocaleLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
