'use client';

import { format, startOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMemo } from 'react';

import { Money } from '@/components/dashboard/money';
import { cn, formatCurrency } from '@/lib/utils';

interface MonthlyTrend {
  month: string; // 'YYYY-MM-01' format
  income: number;
  expenses: number;
  investments: number;
}

const WHOLE_EUROS = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
  // es-ES skips the separator on 4-digit amounts; match the hero (1.224).
  useGrouping: 'always' as unknown as boolean,
});

function wholeEuros(value: number) {
  return WHOLE_EUROS.format(value);
}

function compactEuros(value: number) {
  if (value >= 1000) {
    const k = value / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace('.', ',').replace(',0', '')}k`;
  }
  return `${Math.round(value)}`;
}

/**
 * Six months of spending as quiet bars: past months in grey, the selected
 * month in the foreground colour, with a dashed line at the average.
 */
export default function MonthlyTrendsChart({
  monthlyTrends,
  selectedMonth,
}: {
  monthlyTrends: MonthlyTrend[];
  /** 'yyyy-MM-01' of the month to put in the foreground. */
  selectedMonth?: string;
}) {
  const { months, average, max, current } = useMemo(() => {
    const byMonth = new Map(
      monthlyTrends.map((t) => [t.month.slice(0, 7), t.expenses]),
    );
    const now = startOfMonth(new Date());
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(now, 5 - i);
      const key = format(date, 'yyyy-MM');
      return {
        key,
        label: format(date, 'MMM', { locale: es }).replace('.', ''),
        longLabel: format(date, 'MMMM', { locale: es }),
        expenses: byMonth.get(key) ?? 0,
      };
    });
    const withData = months.filter((m) => m.expenses > 0);
    const average =
      withData.length > 0
        ? withData.reduce((sum, m) => sum + m.expenses, 0) / withData.length
        : 0;
    const max = Math.max(...months.map((m) => m.expenses), 1);
    const selectedKey = (selectedMonth ?? format(now, 'yyyy-MM-01')).slice(
      0,
      7,
    );
    const current =
      months.find((m) => m.key === selectedKey) ?? months[months.length - 1];
    return { months, average, max, current };
  }, [monthlyTrends, selectedMonth]);

  const delta = average > 0 ? (current.expenses - average) / average : 0;
  const deltaText =
    average <= 0 || current.expenses <= 0
      ? 'Sin gastos registrados'
      : Math.abs(delta) < 0.03
        ? 'En línea con tu media'
        : `${Math.round(Math.abs(delta) * 100)} % ${delta < 0 ? 'menos' : 'más'} que tu media`;

  // Leave headroom above the tallest bar for its value label.
  const scale = max * 1.18;

  const caption =
    average > 0 && current.expenses > 0
      ? `${deltaText} (${formatCurrency(average)})`
      : deltaText;

  return (
    <div>
      <p className="text-[13px] text-subtle">
        Gasto de <span className="text-foreground">{current.longLabel}</span>
      </p>
      <p className="mt-1 text-[28px] font-semibold leading-none tracking-[-0.04em]">
        <Money amount={current.expenses} tailClassName="text-[20px]" />
      </p>
      <p className="mt-1.5 text-[13px] text-subtle">{caption}</p>

      <div
        className="relative mt-4 h-[92px] lg:h-32"
        role="img"
        aria-label={`Gasto mensual de los últimos 6 meses. ${months
          .map((m) => `${m.longLabel}: ${formatCurrency(m.expenses)}`)
          .join(', ')}`}
      >
        {average > 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-foreground/35"
            style={{ bottom: `${(average / scale) * 100}%` }}
          >
            <span className="num absolute left-0 top-0 -translate-y-1/2 rounded-md bg-surface py-0.5 pr-1.5 text-[11px] font-medium leading-none text-subtle">
              media {wholeEuros(average)}
            </span>
          </div>
        )}
        <div aria-hidden className="absolute inset-0 flex items-end gap-2">
          {months.map((m) => {
            const isCurrent = m.key === current.key;
            const height = m.expenses > 0 ? (m.expenses / scale) * 100 : 0;
            return (
              <div
                key={m.key}
                className="group relative flex h-full flex-1 flex-col items-center justify-end"
              >
                <span
                  className={cn(
                    'num relative mb-1 rounded-md bg-surface px-1 py-0.5 text-[11px] font-medium leading-none transition-opacity',
                    isCurrent
                      ? 'text-foreground opacity-100'
                      : 'text-subtle opacity-0 group-hover:opacity-100',
                  )}
                >
                  {m.expenses > 0 ? compactEuros(m.expenses) : ''}
                </span>
                <div
                  className={cn(
                    'w-full max-w-10 rounded-[6px] transition-colors',
                    isCurrent
                      ? 'bg-foreground'
                      : 'bg-foreground/20 shadow-[inset_0_2px_0_color-mix(in_srgb,var(--foreground)_18%,transparent)] group-hover:bg-foreground/30',
                  )}
                  style={{
                    height: m.expenses > 0 ? `max(${height}%, 4px)` : '4px',
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div aria-hidden className="mt-2 flex gap-2">
        {months.map((m) => (
          <span
            key={m.key}
            className={cn(
              'flex-1 text-center text-[12px]',
              m.key === current.key
                ? 'font-medium text-foreground'
                : 'text-faint',
            )}
          >
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}
