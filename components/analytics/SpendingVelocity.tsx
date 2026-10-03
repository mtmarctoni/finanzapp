import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

import { ChartLoading, Section } from '@/components/analytics/kit';
import { CategoryTile } from '@/components/quick-add/category-icon';
import { type VelocityItem } from '@/lib/analytics-charts';
import { cn, formatCurrency } from '@/lib/utils';

interface SpendingVelocityProps {
  velocities: VelocityItem[];
  loading: boolean;
  title?: string;
}

function VelocityList({
  heading,
  items,
  direction,
  empty,
}: {
  heading: string;
  items: VelocityItem[];
  direction: 'up' | 'down';
  empty: string;
}) {
  const Arrow = direction === 'up' ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="min-w-0">
      <h3 className="mb-1 text-[13px] font-semibold text-subtle">{heading}</h3>
      {items.length > 0 ? (
        <ul>
          {items.map((item, i) => (
            <li
              key={item.category}
              className={cn(
                'flex h-16 items-center gap-3',
                i > 0 && 'border-t border-hairline',
              )}
            >
              <CategoryTile name={item.category} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold tracking-[-0.01em]">
                  {item.category}
                </p>
                <p className="num truncate text-[13px] text-subtle">
                  {formatCurrency(item.previous)} →{' '}
                  {formatCurrency(item.current)}
                </p>
              </div>
              <span
                className={cn(
                  'num flex shrink-0 items-center gap-0.5 text-[15px] font-semibold',
                  direction === 'down' && 'text-positive',
                )}
              >
                <Arrow className="h-4 w-4" />
                {direction === 'up' ? '+' : ''}
                {Math.round(item.changePercent) || 0}%
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-3 text-[13px] text-faint">{empty}</p>
      )}
    </div>
  );
}

export function SpendingVelocity({
  velocities,
  loading,
  title = 'Velocidad de gasto',
}: SpendingVelocityProps) {
  const growing = velocities.filter((v) => v.direction === 'up').slice(0, 3);
  const shrinking = velocities
    .filter((v) => v.direction === 'down')
    .slice(0, 3);

  return (
    <Section
      title={title}
      description="Lo que más ha cambiado respecto al periodo anterior"
    >
      {loading ? (
        <ChartLoading className="h-48" />
      ) : growing.length === 0 && shrinking.length === 0 ? (
        <p className="text-[13px] text-faint">
          Ningún cambio significativo respecto al periodo anterior
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-8 lg:grid-cols-1 lg:gap-4">
          <VelocityList
            heading="Creciendo"
            items={growing}
            direction="up"
            empty="Ninguna categoría creciendo significativamente"
          />
          <VelocityList
            heading="Reduciendo"
            items={shrinking}
            direction="down"
            empty="Ninguna categoría reduciendo significativamente"
          />
        </div>
      )}
    </Section>
  );
}
