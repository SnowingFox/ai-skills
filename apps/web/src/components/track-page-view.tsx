'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

function getVisitorId(): string {
  const KEY = 'ai_skills_vid';
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function TrackPageView() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (pathname === lastTracked.current) return;
    lastTracked.current = pathname;

    const visitorId = getVisitorId();
    const body = JSON.stringify({
      path: pathname,
      visitorId,
      referrer: document.referrer || undefined,
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/analytics/track',
        new Blob([body], { type: 'application/json' })
      );
    } else {
      fetch('/api/analytics/track', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {});
    }
  }, [pathname]);

  return null;
}
