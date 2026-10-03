import { Amount, fmtPct } from '@/components/analytics/kit';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SavingsRateCardProps {
  income: number;
  expenses: number;
  /** Target savings rate in percent; drawn as a tick on the bar. */
  target?: number;
  /** Render without card chrome, to sit inside another card. */
  bare?: boolean;
  className?: string;
}

export function SavingsRateCard({
  income,
  expenses,
  target = 20,
  bare = false,
  className,
}: SavingsRateCardProps) {
  const savings = income - expenses;
  const rate = income > 0 ? (savings / income) * 100 : 0;
  const isPositive = savings >= 0;
  const fill = Math.min(100, Math.max(0, rate));

  const body = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-subtle">Tasa de ahorro</p>
        <p className="num text-[12px] text-faint">Meta {target} %</p>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span
          className={cn(
            'display-num text-[32px] font-semibold',
            !isPositive && 'text-negative',
          )}
        >
          {fmtPct(rate)}
        </span>
        <span className="truncate text-[13px] text-subtle">
          {isPositive ? 'Ahorrando' : 'Gastando más de lo que entra'}
        </span>
      </div>
      <div
        className="relative mt-3 h-1.5 w-full rounded-full bg-surface-3"
        role="meter"
        aria-label="Tasa de ahorro"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill)}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width]',
            rate >= target ? 'bg-positive' : 'bg-foreground',
          )}
          style={{ width: `${fill}%` }}
        />
        <span
          aria-hidden
          className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-subtle"
          style={{ left: `calc(${target}% - 1px)` }}
        />
      </div>
      {/* Inside the hero the breakdown would repeat the hero and the tiles. */}
      {!bare && (
        <dl className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
          <div className="min-w-0">
            <dt className="text-faint">Ingresos</dt>
            <dd className="num truncate font-medium">
              <Amount amount={income} />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-faint">Gastos</dt>
            <dd className="num truncate font-medium">
              <Amount amount={expenses} />
            </dd>
          </div>
          <div className="min-w-0 text-right">
            <dt className="text-faint">Neto</dt>
            <dd
              className={cn(
                'num truncate font-medium',
                isPositive && 'text-positive',
              )}
            >
              <Amount amount={savings} sign={savings > 0 ? '+' : undefined} />
            </dd>
          </div>
        </dl>
      )}
    </>
  );

  if (bare) return <div className={className}>{body}</div>;
  return <Card className={cn('p-4 md:p-5', className)}>{body}</Card>;
}
