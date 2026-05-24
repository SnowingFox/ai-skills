import { Analytics } from '@/analytics/analytics';
import {
  fontBricolageGrotesque,
  fontNotoSans,
  fontNotoSansMono,
  fontNotoSerif,
} from '@/assets/fonts';
import { RegistryHeader } from '@/components/layout/registry-header';
import { TailwindIndicator } from '@/components/layout/tailwind-indicator';
import { TrackPageView } from '@/components/track-page-view';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import '@/styles/globals.css';

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
        <TrackPageView />
        <TailwindIndicator />
        <Analytics />
      </body>
    </html>
  );
}
