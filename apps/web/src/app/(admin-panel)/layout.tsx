import {
  fontBricolageGrotesque,
  fontNotoSans,
  fontNotoSansMono,
  fontNotoSerif,
} from '@/assets/fonts';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import '@/styles/globals.css';

export default function AdminPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
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
        {children}
      </body>
    </html>
  );
}
