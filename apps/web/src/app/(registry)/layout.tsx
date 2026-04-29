import { Analytics } from '@/analytics/analytics';
import {
  fontBricolageGrotesque,
  fontNotoSans,
  fontNotoSansMono,
  fontNotoSerif,
} from '@/assets/fonts';
import { TailwindIndicator } from '@/components/layout/tailwind-indicator';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { ReactNode } from 'react';
import '@/styles/globals.css';

function RegistryHeader() {
  return (
    <header className="sticky top-0 z-50 bg-background">
      <div className="flex h-14 items-center justify-between gap-6 px-4">
        <Link
          href="/"
          aria-label="Skills home"
          className="flex items-center gap-2 rounded outline-none focus-visible:outline-focus"
        >
          <svg
            aria-hidden="true"
            height="18"
            viewBox="0 0 16 16"
            width="18"
            className="fill-current"
          >
            <path fillRule="evenodd" clipRule="evenodd" d="M8 1L16 15H0L8 1Z" />
          </svg>
          <span className="font-medium text-lg tracking-tight">Skills</span>
        </Link>

        <nav aria-label="Primary" className="flex items-baseline gap-6">
          <Link
            href="/official"
            className="text-muted-foreground text-sm transition-colors hover:text-foreground"
          >
            Official
          </Link>
          <Link
            href="/audits"
            className="text-muted-foreground text-sm transition-colors hover:text-foreground"
          >
            Audits
          </Link>
          <Link
            href="/docs"
            className="text-muted-foreground text-sm transition-colors hover:text-foreground"
          >
            Docs
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default function RegistryLayout({ children }: { children: ReactNode }) {
  return (
    <html
      suppressHydrationWarning
      lang="en"
      className={cn(
        'dark',
        fontNotoSans.className,
        fontNotoSerif.variable,
        fontNotoSansMono.variable,
        fontBricolageGrotesque.variable
      )}
    >
      <body className="size-full bg-background text-foreground antialiased">
        <RegistryHeader />
        {children}
        <TailwindIndicator />
        <Analytics />
      </body>
    </html>
  );
}
