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
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto grid h-11 max-w-6xl animate-in grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 fade-in slide-in-from-top-2 duration-500 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <LocaleLink
            href={Routes.Root}
            aria-label="Home"
            className="group flex items-center rounded outline-none focus-visible:outline-focus"
          >
            <span className="font-mono text-[13px] font-semibold uppercase tracking-[-0.02em] transition-opacity group-hover:opacity-80">
              AI-SKILLS
            </span>
          </LocaleLink>
        </div>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-6 justify-self-center md:flex"
        >
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
                  'relative py-1 text-[13px] text-muted-foreground transition-colors after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-foreground after:transition-transform hover:text-foreground hover:after:scale-x-100',
                  isActive && 'text-foreground after:scale-x-100'
                )}
              >
                {item.label}
              </LocaleLink>
            );
          })}
        </nav>

        <div className="flex items-center justify-end gap-2">
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
