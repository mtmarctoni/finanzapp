import { Money } from '@/components/dashboard/money';
import { formatNextDate } from '@/components/recurring/utils';
import { cn } from '@/lib/utils';

interface SummaryCardsProps {
  activeRecords: number;
  inactiveRecords: number;
  monthlyCommitted: number;
  monthlyIncome: number;
  monthlyEstimate: number;
  nextCharge: { name: string; date: Date } | null;
}

export function SummaryCards({
  activeRecords,
  inactiveRecords,
  monthlyCommitted,
  monthlyIncome,
  monthlyEstimate,
  nextCharge,
}: SummaryCardsProps) {
  return (
    <section
      aria-label="Resumen"
      className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"
    >
      <div className="col-span-2 rounded-[20px] border border-hairline bg-surface p-5 lg:col-span-1">
        <p className="text-[13px] font-medium text-subtle">
          Comprometido al mes
        </p>
        <p className="mt-3">
          <Money
            amount={monthlyCommitted}
            className="display-num text-[44px] font-semibold md:text-[56px]"
            tailClassName="text-[26px] font-medium text-faint md:text-[32px]"
          />
        </p>
        <p className="mt-3 text-[13px] text-subtle">
          {activeRecords}{' '}
          {activeRecords === 1 ? 'cargo activo' : 'cargos activos'}
          {inactiveRecords > 0 && (
            <span className="text-faint">
              {' '}
              · {inactiveRecords}{' '}
              {inactiveRecords === 1 ? 'pausado' : 'pausados'}
            </span>
          )}
          <span className="text-faint"> · neto </span>
          <span
            className={cn(
              'num font-medium',
              monthlyEstimate > 0 ? 'text-positive' : 'text-foreground',
            )}
          >
            <Money
              amount={monthlyEstimate}
              signed
              tailClassName="text-inherit"
            />
          </span>
        </p>
      </div>

      <div className="flex flex-col rounded-[20px] border border-hairline bg-surface p-4">
        <p className="text-[13px] font-medium text-subtle">Ingresos fijos</p>
        <p className="mt-auto pt-3 text-[22px] font-semibold tracking-[-0.03em] text-positive lg:text-[28px]">
          <Money
            amount={monthlyIncome}
            signed
            tailClassName="text-[15px] text-positive/60"
          />
        </p>
      </div>
      <div className="flex min-w-0 flex-col rounded-[20px] border border-hairline bg-surface p-4">
        <p className="text-[13px] font-medium text-subtle">Próximo cargo</p>
        {nextCharge ? (
          <div className="mt-auto pt-3">
            <p className="truncate text-[22px] font-semibold tracking-[-0.03em] lg:text-[28px]">
              {formatNextDate(nextCharge.date)}
            </p>
            <p className="truncate text-[12px] text-faint">{nextCharge.name}</p>
          </div>
        ) : (
          <p className="mt-2 text-[22px] font-semibold text-faint">—</p>
        )}
      </div>
    </section>
  );
}
