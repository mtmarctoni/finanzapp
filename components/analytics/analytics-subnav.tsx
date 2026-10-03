'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { pillClass } from '@/components/analytics/kit';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/analytics', label: 'General' },
  { href: '/analytics/tipo', label: 'Por tipo' },
];

/**
 * Section tabs for /analytics. Sticks to the top on mobile so the switch is
 * always one tap away. Until content scrolls under it the bar is fully
 * transparent (reads as the page itself); once stuck it gets a blurred page
 * tone and a single hairline.
 */
export function AnalyticsSubnav({ actions }: { actions?: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const suffix = query ? `?${query}` : '';

  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) =>
      setStuck(!entry.isIntersecting),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden className="h-px" />
      <div
        className={cn(
          'sticky top-0 z-30 -mx-4 -mt-px flex items-center gap-2 border-b px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] transition-colors md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none',
          stuck
            ? 'border-hairline bg-background/80 backdrop-blur-xl'
            : 'border-transparent bg-transparent',
        )}
      >
        <nav className="flex min-w-0 flex-1 gap-2" aria-label="Analíticas">
          {LINKS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={`${href}${suffix}`}
                className={cn(
                  pillClass(active),
                  active && 'pointer-events-none',
                )}
                aria-current={active ? 'page' : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        {actions && <div className="flex shrink-0 items-center">{actions}</div>}
      </div>
    </>
  );
}
