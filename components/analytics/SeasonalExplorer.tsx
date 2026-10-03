'use client';

import { Flower2, Leaf, Snowflake, Sun } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  Amount,
  EmptyState,
  ChartLoading,
  fmtShort,
  PillSelect,
  Section,
} from '@/components/analytics/kit';
import { type CategoryTemporalDatum } from '@/lib/analytics-charts';
import { cn, formatCurrency } from '@/lib/utils';

interface SeasonalExplorerProps {
  categoryTemporalData: CategoryTemporalDatum[];
  types: string[];
  loading: boolean;
}

export function SeasonalExplorer({
  categoryTemporalData,
  types,
  loading,
}: SeasonalExplorerProps) {
  const [pickedTipo, setSelectedTipo] = useState<string>('');
  const selectedTipo = pickedTipo || types[0] || '';
  const [selectedQue, setSelectedQue] = useState<string>('__all__');

  // Build tipo → que mapping
  const tipoToQueMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const item of categoryTemporalData) {
      if (!map.has(item.type)) map.set(item.type, new Set());
      map.get(item.type)?.add(item.category);
    }
    return map;
  }, [categoryTemporalData]);

  const availableQue =
    selectedTipo && tipoToQueMap.has(selectedTipo)
      ? Array.from(tipoToQueMap.get(selectedTipo) ?? []).sort()
      : [];

  const handleTipoChange = (tipo: string) => {
    setSelectedTipo(tipo);
    setSelectedQue('__all__');
  };

  // Compute seasonal data
  const seasonalData = useMemo(() => {
    const monthNames = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];

    const filtered = categoryTemporalData.filter((item) => {
      if (selectedQue && selectedQue !== '__all__')
        return item.category === selectedQue && item.action === 'Gasto';
      if (selectedTipo)
        return item.type === selectedTipo && item.action === 'Gasto';
      return false;
    });

    const byMonth = new Map<
      number,
      { total: number; count: number; yearCount: number }
    >();
    for (let i = 0; i < 12; i++) {
      byMonth.set(i, { total: 0, count: 0, yearCount: 0 });
    }

    for (const item of filtered) {
      const d = new Date(item.period);
      const month = d.getUTCMonth();
      const existing = byMonth.get(month) as {
        total: number;
        count: number;
        yearCount: number;
      };
      existing.total += Math.abs(Number(item.total));
      existing.count += item.count ?? 0;
      existing.yearCount += 1;
    }

    return Array.from(byMonth.entries()).map(([month, data]) => ({
      month,
      monthName: monthNames[month],
      total: data.yearCount > 0 ? data.total / data.yearCount : 0,
      count: data.yearCount > 0 ? Math.round(data.count / data.yearCount) : 0,
    }));
  }, [categoryTemporalData, selectedTipo, selectedQue]);

  const sorted = [...seasonalData].sort((a, b) => b.total - a.total);
  const peakMonth = sorted[0];
  const lowMonth = sorted[sorted.length - 1];
  const max = peakMonth.total;
  const hasData = max > 0;

  const seasons = [
    { name: 'Invierno', months: [11, 0, 1], icon: Snowflake },
    { name: 'Primavera', months: [2, 3, 4], icon: Flower2 },
    { name: 'Verano', months: [5, 6, 7], icon: Sun },
    { name: 'Otoño', months: [8, 9, 10], icon: Leaf },
  ];

  const seasonTotals = seasons.map((season) => {
    const total = seasonalData
      .filter((s) => season.months.includes(s.month))
      .reduce((sum, s) => sum + s.total, 0);
    return { ...season, total };
  });
  const topSeason = Math.max(...seasonTotals.map((s) => s.total));

  return (
    <Section
      title="Patrones estacionales"
      description="¿En qué meses gastas más? Media por mes del año"
      action={
        <>
          <PillSelect
            ariaLabel="Tipo"
            value={selectedTipo}
            onValueChange={handleTipoChange}
            placeholder="Tipo (general)"
            options={types}
          />
          <PillSelect
            ariaLabel="Categoría"
            value={selectedQue}
            onValueChange={setSelectedQue}
            disabled={!selectedTipo}
            placeholder={
              selectedTipo
                ? 'Categoría (específica)'
                : 'Selecciona tipo primero'
            }
            allOption={{ value: '__all__', label: 'Todas las categorías' }}
            options={availableQue}
          />
        </>
      }
    >
      {loading ? (
        <ChartLoading className="h-48" />
      ) : !selectedTipo ? (
        <EmptyState>
          Selecciona un tipo para ver sus patrones estacionales
        </EmptyState>
      ) : !hasData ? (
        <EmptyState>No hay datos estacionales</EmptyState>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ol
              aria-label="Gasto medio por mes"
              className="grid h-40 grid-cols-12 items-end gap-1 md:gap-2"
            >
              {seasonalData.map((m) => {
                const isPeak = m.month === peakMonth.month;
                return (
                  <li
                    key={m.month}
                    className="flex h-full min-w-0 flex-col items-center justify-end gap-1.5"
                    title={`${m.monthName}: ${formatCurrency(m.total)}`}
                  >
                    <span
                      className={cn(
                        'num hidden text-[10px] md:block',
                        isPeak ? 'text-foreground' : 'text-faint',
                      )}
                    >
                      {m.total > 0 ? fmtShort(m.total) : ''}
                    </span>
                    <span className="flex min-h-0 w-full flex-1 items-end justify-center">
                      <span
                        className={cn(
                          'w-full max-w-5 rounded-[4px]',
                          isPeak ? 'bg-foreground' : 'bg-surface-4',
                        )}
                        style={{
                          height: `${Math.max((m.total / max) * 100, 2)}%`,
                        }}
                      />
                    </span>
                    <span
                      className={cn(
                        'text-[10px] md:text-[11px]',
                        isPeak ? 'font-semibold text-foreground' : 'text-faint',
                      )}
                    >
                      {m.monthName.charAt(0)}
                      <span className="hidden md:inline">
                        {m.monthName.slice(1)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-surface-2 p-3">
                <dt className="text-[12px] text-faint">Pico</dt>
                <dd className="text-[17px] font-semibold">
                  {peakMonth.monthName}
                </dd>
                <dd className="num text-[12px] text-subtle">
                  <Amount amount={peakMonth.total} />
                </dd>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <dt className="text-[12px] text-faint">Valle</dt>
                <dd className="text-[17px] font-semibold">
                  {lowMonth.monthName}
                </dd>
                <dd className="num text-[12px] text-subtle">
                  <Amount amount={lowMonth.total} />
                </dd>
              </div>
            </dl>
            <ul aria-label="Por estación">
              {seasonTotals.map((season, i) => {
                const Icon = season.icon;
                return (
                  <li
                    key={season.name}
                    className={cn(
                      'flex h-11 items-center justify-between gap-3',
                      i > 0 && 'border-t border-hairline',
                    )}
                  >
                    <span className="flex items-center gap-2 text-[15px]">
                      <Icon className="h-4 w-4 text-faint" />
                      {season.name}
                    </span>
                    <span
                      className={cn(
                        'num text-[15px] font-semibold',
                        season.total !== topSeason && 'text-subtle',
                      )}
                    >
                      <Amount amount={season.total} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </Section>
  );
}
