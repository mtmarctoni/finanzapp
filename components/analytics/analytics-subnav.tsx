'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/analytics', label: 'General' },
  { href: '/analytics/tipo', label: 'Por Tipo' },
];

export function AnalyticsSubnav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const suffix = query ? `?${query}` : '';

  return (
    <nav className="flex gap-2" aria-label="Analíticas">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={`${href}${suffix}`}
            className={cn(
              buttonVariants({
                variant: active ? 'default' : 'outline',
                size: 'sm',
              }),
              active && 'pointer-events-none',
            )}
            aria-current={active ? 'page' : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
