import { TrendingUp } from 'lucide-react';

import { SavingsRateCard } from '@/components/analytics/SavingsRateCard';
import { Amount, FigureGrid, HeroAmount } from '@/components/analytics/kit';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatCurrency } from '@/lib/utils';

const COUNT = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

interface SummaryCardsProps {
  sums: { gastos: number; ingresos: number; inversion: number };
  metrics?: {
    totalAmount: number;
    entryCount: number;
    periodCount: number;
    avgPerPeriodAmount: number;
    avgPerPeriodCount: number;
    perAction: {
      Ingreso: { amount: number; count: number };
      Gasto: { amount: number; count: number };
      Inversión: { amount: number; count: number };
    };
    groupBy: 'month' | 'year';
    useActivePeriods: boolean;
  };
  monthsInRange: number;
  yearsInRange: number;
  loading?: boolean;
}

/**
 * Overview for the selected range: one hero figure (what went out) with the
 * savings rate underneath, and a 2-up grid of supporting figures.
 */
export function SummaryCards({
  sums,
  metrics,
  monthsInRange,
  yearsInRange,
  loading = false,
}: SummaryCardsProps) {
  const perMonth = (n: number) => (monthsInRange > 0 ? n / monthsInRange : 0);
  const perYear = (n: number) => (yearsInRange > 0 ? n / yearsInRange : 0);
  const net = sums.ingresos - sums.gastos - sums.inversion;
  const unit = metrics?.groupBy === 'year' ? 'año' : 'mes';

  if (loading && !metrics) {
    return (
      <div className="grid gap-3 lg:grid-cols-4">
        <Skeleton className="h-[264px] rounded-[20px] lg:col-span-2" />
        <Skeleton className="h-[200px] rounded-[20px] lg:col-span-2 lg:h-auto" />
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-4">
      <Card className="flex flex-col justify-between gap-5 p-5 lg:col-span-2">
        <div>
          <p className="text-[13px] font-medium text-subtle">Gastado</p>
          <HeroAmount amount={sums.gastos} className="mt-2 block" />
          <p className="num mt-2 text-[13px] text-subtle">
            {formatCurrency(perMonth(sums.gastos))}/mes
            <span className="text-faint">
              {' · '}
              {formatCurrency(perYear(sums.gastos))}/año
            </span>
          </p>
          {metrics && (
            <p className="num mt-0.5 text-[12px] text-faint">
              {metrics.perAction.Gasto.count} gastos de {metrics.entryCount}{' '}
              movimientos
            </p>
          )}
        </div>
        <div className="border-t border-hairline pt-4">
          <SavingsRateCard bare income={sums.ingresos} expenses={sums.gastos} />
        </div>
      </Card>

      <FigureGrid
        className="lg:col-span-2 lg:auto-rows-fr"
        items={[
          {
            key: 'Ingresos',
            label: 'Ingresos',
            value: (
              <Amount
                amount={sums.ingresos}
                sign="+"
                className="text-positive"
              />
            ),
            sub: (
              <>
                <p className="num truncate">
                  {formatCurrency(perMonth(sums.ingresos))}/mes
                </p>
                {metrics && (
                  <p className="num">{metrics.perAction.Ingreso.count} mov.</p>
                )}
              </>
            ),
          },
          {
            key: 'Inversión',
            label: 'Inversión',
            icon: (
              <TrendingUp aria-hidden className="h-3.5 w-3.5 text-invest" />
            ),
            value: <Amount amount={sums.inversion} />,
            sub: (
              <>
                <p className="num truncate">
                  {formatCurrency(perMonth(sums.inversion))}/mes
                </p>
                {metrics && (
                  <p className="num">
                    {metrics.perAction.Inversión.count} mov.
                  </p>
                )}
              </>
            ),
          },
          {
            key: 'Neto',
            label: 'Neto',
            value: (
              <Amount
                amount={net}
                sign={net > 0 ? '+' : undefined}
                className={cn(net > 0 && 'text-positive')}
              />
            ),
            sub: <p>Tras gastos e inversión</p>,
          },
          {
            key: 'Media',
            label: `Media por ${unit}`,
            value: <Amount amount={metrics?.avgPerPeriodAmount ?? 0} />,
            sub: (
              <>
                <p className="num">
                  {COUNT.format(metrics?.avgPerPeriodCount ?? 0)} mov./{unit}
                </p>
                <p className="num">{metrics?.periodCount ?? 0} periodos</p>
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
