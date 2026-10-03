'use client';

import { CalendarDays, ChevronDown, TrendingUp } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { SavingsRateCard } from '@/components/analytics/SavingsRateCard';
import { SpendingVelocity } from '@/components/analytics/SpendingVelocity';
import { TipoExplorer } from '@/components/analytics/TipoExplorer';
import { TrendExplorer } from '@/components/analytics/TrendExplorer';
import { AnalyticsSubnav } from '@/components/analytics/analytics-subnav';
import {
  Amount,
  ChartLoading,
  EmptyState,
  FigureGrid,
  HeroAmount,
  Pill,
  pillClass,
  RankedBars,
  Section,
} from '@/components/analytics/kit';
import { TipoEntriesTable } from '@/components/analytics/tipo-entries-table';
import { PageHeader } from '@/components/page-header';
import { CategoryTile } from '@/components/quick-add/category-icon';
import { Card } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAnalyticsData } from '@/hooks/use-analytics-data';
import {
  computeMonthlyAverages,
  computeSpendingVelocity,
  getCategoryTrendData,
  getLineChartOptions,
  getTipoExplorerData,
  getTipoQueDoughnutData,
  getTipoTrendData,
} from '@/lib/analytics-charts';
import { cn, formatCurrency } from '@/lib/utils';

const MONTHS = [
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

type ActionKey = 'Ingreso' | 'Gasto' | 'Inversión';

function lastDayOfMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export default function TipoPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, filters, loading } = useAnalyticsData({
    ignoreTipoFromUrl: true,
  });

  const tipos = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...data.typeData.map((d) => d.type),
            ...data.tipoQueData.map((d) => d.type),
            ...data.typeTemporalData.map((d) => d.type),
            ...data.categoryTemporalData.map((d) => d.type),
          ].filter(Boolean),
        ),
      ).sort(),
    [
      data.typeData,
      data.tipoQueData,
      data.typeTemporalData,
      data.categoryTemporalData,
    ],
  );

  const urlTipo = searchParams.get('type') ?? '';
  const selectedTipo = urlTipo || tipos[0] || 'Gasto';

  const tipoToQueMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const item of data.tipoQueData) {
      if (!map.has(item.type)) map.set(item.type, new Set());
      map.get(item.type)?.add(item.category);
    }
    return map;
  }, [data.tipoQueData]);

  const queOptions = useMemo(
    () =>
      Array.from(tipoToQueMap.get(selectedTipo) ?? new Set<string>()).sort(),
    [tipoToQueMap, selectedTipo],
  );

  const [selectedQue, setSelectedQue] = useState<string>('todos');

  // Keep the active tipo visible in the horizontally scrolling rail.
  const tipoRail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const active = tipoRail.current?.querySelector<HTMLElement>(
      '[aria-pressed="true"]',
    );
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- jsdom has no scrollIntoView
    active?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
  }, [selectedTipo, tipos.length]);

  const years = useMemo(() => {
    if (data.availableYears.length > 0) {
      return Array.from(new Set(data.availableYears)).sort((a, b) => b - a);
    }
    return Array.from(
      new Set(
        data.temporalData.map((d) => new Date(d.period).getUTCFullYear()),
      ),
    ).sort((a, b) => b - a);
  }, [data.availableYears, data.temporalData]);

  const fromStr = searchParams.get('from') ?? '';
  const toStr = searchParams.get('to') ?? '';
  const activeYear = fromStr
    ? Number(fromStr.slice(0, 4))
    : (years[0] ?? new Date().getFullYear());

  const isFullYear =
    fromStr &&
    toStr &&
    fromStr.endsWith('-01-01') &&
    toStr.endsWith('-12-31') &&
    fromStr.slice(0, 4) === toStr.slice(0, 4);
  const activeMonth = !isFullYear && fromStr ? Number(fromStr.slice(5, 7)) : 0;

  const updateUrl = (overrides: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    }
    router.replace(`/analytics/tipo?${params.toString()}`);
  };

  const handleTipoChange = (tipo: string) => {
    setSelectedQue('todos');
    updateUrl({ type: tipo });
  };

  const handlePeriod = (from: string | null, to: string | null) => {
    updateUrl({ from, to });
  };

  const perAction = useMemo(() => {
    const base: Record<ActionKey, { amount: number; count: number }> = {
      Ingreso: { amount: 0, count: 0 },
      Gasto: { amount: 0, count: 0 },
      Inversión: { amount: 0, count: 0 },
    };
    for (const item of data.tipoQueData) {
      if (item.type !== selectedTipo) continue;
      const entry = base[item.action as ActionKey];
      entry.amount += Math.abs(Number(item.total));
      entry.count += Number(item.count ?? 0);
    }
    return base;
  }, [data.tipoQueData, selectedTipo]);

  const net =
    perAction.Ingreso.amount -
    perAction.Gasto.amount -
    perAction.Inversión.amount;

  const categoryBreakdown = getTipoQueDoughnutData(
    data.tipoQueData,
    selectedTipo,
  );
  const queVelocities = computeSpendingVelocity(
    data.categoryTemporalData.filter((d) => d.type === selectedTipo),
    'Gasto',
  );

  const averagesSeries = useMemo(
    () => data.typeTemporalData.filter((d) => d.type === selectedTipo),
    [data.typeTemporalData, selectedTipo],
  );

  const averages = useMemo(
    () => computeMonthlyAverages(averagesSeries),
    [averagesSeries],
  );

  const averageByAction = useMemo(() => {
    const map = new Map<string, number>();
    for (const stat of averages.overall) {
      map.set(stat.action, stat.average);
    }
    return map;
  }, [averages]);

  const hasAverage = averages.totalMonths > 0;

  const netAverage = hasAverage
    ? Math.abs(
        (averageByAction.get('Ingreso') ?? 0) -
          (averageByAction.get('Gasto') ?? 0) -
          (averageByAction.get('Inversión') ?? 0),
      )
    : null;

  const tableFilters = {
    tipo: selectedTipo,
    que: selectedQue !== 'todos' ? selectedQue : undefined,
    from: fromStr || undefined,
    to: toStr || undefined,
  };

  const metrics = [
    {
      key: 'Gasto',
      label: 'Gastos',
      amount: perAction.Gasto.amount,
      count: perAction.Gasto.count as number | null,
      sign: '-' as const,
      tone: undefined,
      average: hasAverage ? (averageByAction.get('Gasto') ?? 0) : null,
    },
    {
      key: 'Ingreso',
      label: 'Ingresos',
      amount: perAction.Ingreso.amount,
      count: perAction.Ingreso.count as number | null,
      sign: '+' as const,
      tone: 'positive' as const,
      average: hasAverage ? (averageByAction.get('Ingreso') ?? 0) : null,
    },
    {
      key: 'Inversión',
      label: 'Inversión',
      amount: perAction.Inversión.amount,
      count: perAction.Inversión.count as number | null,
      sign: '' as const,
      tone: 'invest' as const,
      average: hasAverage ? (averageByAction.get('Inversión') ?? 0) : null,
    },
  ];
  // The hero is whichever side of the ledger dominates this tipo (rent is
  // an expense, a salary is income); the rest become compact tiles.
  const hero = metrics.reduce((a, b) => (b.amount > a.amount ? b : a));
  const tiles = [
    ...metrics.filter((m) => m !== hero),
    {
      key: 'Neto',
      label: 'Neto',
      amount: Math.abs(net),
      count: null,
      sign: (net >= 0 ? '+' : '-') as '+' | '-',
      tone: net >= 0 ? ('positive' as const) : undefined,
      average: netAverage,
    },
  ];

  const periodLabel = !fromStr
    ? 'Todo'
    : isFullYear
      ? fromStr.slice(0, 4)
      : `${MONTHS[activeMonth - 1] ?? ''} ${fromStr.slice(0, 4)}`.trim();

  return (
    <div className="min-w-0">
      <PageHeader
        title="Análisis"
        actions={
          years.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[13px] font-semibold"
                  aria-label={`Periodo: ${periodLabel}`}
                >
                  <CalendarDays className="h-4 w-4 text-subtle" />
                  {periodLabel}
                  <ChevronDown className="h-4 w-4 text-subtle" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-[min(20rem,calc(100vw-2rem))] space-y-3 p-3"
              >
                <div
                  role="group"
                  aria-label="Año"
                  className="flex flex-wrap gap-1.5"
                >
                  <Pill
                    active={!fromStr}
                    onClick={() => handlePeriod(null, null)}
                  >
                    Todo
                  </Pill>
                  {years.map((year) => (
                    <Pill
                      key={year}
                      active={Boolean(isFullYear) && activeYear === year}
                      onClick={() =>
                        handlePeriod(`${year}-01-01`, `${year}-12-31`)
                      }
                    >
                      {year}
                    </Pill>
                  ))}
                </div>
                <div className="border-t border-hairline pt-3">
                  <p className="mb-2 text-[12px] text-faint">
                    Meses de {activeYear}
                  </p>
                  <div
                    role="group"
                    aria-label="Mes"
                    className="grid grid-cols-4 gap-1.5"
                  >
                    {MONTHS.map((month, index) => (
                      <Pill
                        key={month}
                        active={activeMonth === index + 1}
                        className="px-0"
                        onClick={() => {
                          const pad = String(index + 1).padStart(2, '0');
                          handlePeriod(
                            `${activeYear}-${pad}-01`,
                            `${activeYear}-${pad}-${String(lastDayOfMonth(activeYear, index)).padStart(2, '0')}`,
                          );
                        }}
                      >
                        {month}
                      </Pill>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )
        }
      />
      <AnalyticsSubnav />

      <div className="mt-3 space-y-2">
        <div
          ref={tipoRail}
          role="group"
          aria-label="Tipo"
          className="rail -mx-4 px-4 py-0.5 md:mx-0 md:flex-wrap md:px-0 md:[mask-image:none]"
        >
          {tipos.map((tipo) => (
            <Pill
              key={tipo}
              active={selectedTipo === tipo}
              onClick={() => handleTipoChange(tipo)}
            >
              {tipo}
            </Pill>
          ))}
        </div>
        {queOptions.length > 0 && (
          <div
            role="group"
            aria-label="Que"
            className="rail -mx-4 px-4 py-0.5 md:mx-0 md:flex-wrap md:px-0 md:[mask-image:none]"
          >
            <span className="flex shrink-0 items-center pr-1 text-[12px] font-medium text-faint">
              Que
            </span>
            {[
              { key: 'todos', label: 'Todos' },
              ...queOptions.map((q) => ({ key: q, label: q })),
            ].map((q) => (
              <button
                key={q.key}
                type="button"
                aria-pressed={selectedQue === q.key}
                onClick={() => setSelectedQue(q.key)}
                className={cn(
                  pillClass(selectedQue === q.key),
                  'h-9 px-3.5 font-medium',
                )}
              >
                {q.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 space-y-3 md:space-y-4">
        <div className="grid gap-3 lg:grid-cols-4">
          <Card
            data-metric={hero.key}
            className="flex flex-col justify-between gap-4 p-5 lg:col-span-2"
          >
            <div>
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-subtle">
                {hero.key === 'Inversión' && (
                  <TrendingUp aria-hidden className="h-3.5 w-3.5 text-invest" />
                )}
                {hero.label}
              </p>
              <HeroAmount
                amount={hero.amount}
                sign={hero.amount > 0 ? hero.sign : ''}
                className={cn(
                  'mt-2 block',
                  hero.tone === 'positive' && 'text-positive',
                )}
              />
            </div>
            <p className="num text-[13px] text-subtle">
              {hero.count} mov.
              {hero.average !== null && (
                <span
                  className="text-faint"
                  title="Promedio por mes de calendario entre el primer y el último movimiento; los meses sin movimientos cuentan como 0."
                >
                  {' · '}
                  {formatCurrency(hero.average)}/mes
                </span>
              )}
            </p>
          </Card>
          <FigureGrid
            className="lg:col-span-2 lg:auto-rows-fr"
            items={tiles.map((t) => ({
              key: t.key,
              label: t.label,
              icon:
                t.key === 'Inversión' ? (
                  <TrendingUp aria-hidden className="h-3.5 w-3.5 text-invest" />
                ) : undefined,
              value: (
                <Amount
                  amount={t.amount}
                  sign={t.amount > 0 ? t.sign : ''}
                  className={cn(t.tone === 'positive' && 'text-positive')}
                />
              ),
              sub: (
                <>
                  {t.count !== null && <p className="num">{t.count} mov.</p>}
                  {t.average !== null && (
                    <p
                      className="num truncate"
                      title="Promedio por mes de calendario entre el primer y el último movimiento; los meses sin movimientos cuentan como 0."
                    >
                      {formatCurrency(t.average)}/mes
                    </p>
                  )}
                </>
              ),
            }))}
          />
        </div>

        <div className="grid gap-3 md:gap-4 lg:grid-cols-2">
          <Section
            title="Gasto por categoría"
            description={
              categoryBreakdown.total > 0 ? (
                <span className="num">
                  {formatCurrency(categoryBreakdown.total)} en {selectedTipo}
                </span>
              ) : undefined
            }
          >
            {loading ? (
              <ChartLoading className="h-48" />
            ) : categoryBreakdown.labels.length > 0 ? (
              <RankedBars
                ariaLabel="Gasto por categoría"
                shareLabel="del gasto"
                limit={6}
                items={categoryBreakdown.labels.map((label, index) => {
                  const value = Number(
                    categoryBreakdown.datasets[0].data[index] ?? 0,
                  );
                  return {
                    key: label,
                    label,
                    value,
                    pct:
                      categoryBreakdown.total > 0
                        ? (value / categoryBreakdown.total) * 100
                        : 0,
                    icon: <CategoryTile name={label} />,
                  };
                })}
              />
            ) : (
              <EmptyState>No hay datos disponibles</EmptyState>
            )}
          </Section>

          <div className="grid content-start gap-3 md:gap-4">
            {perAction.Ingreso.amount > 0 && (
              <SavingsRateCard
                income={perAction.Ingreso.amount}
                expenses={perAction.Gasto.amount}
              />
            )}
            <SpendingVelocity
              velocities={queVelocities}
              loading={loading}
              title={`Velocidad de gasto en ${selectedTipo}`}
            />
          </div>
        </div>

        <TipoExplorer
          tipoQueData={data.tipoQueData}
          types={tipos}
          getChartData={getTipoExplorerData}
          loading={loading}
          selectedTipo={selectedTipo}
          onTipoChange={handleTipoChange}
        />

        <TrendExplorer
          categoryTemporalData={data.categoryTemporalData}
          typeTemporalData={data.typeTemporalData}
          tipoQueData={data.tipoQueData}
          types={tipos}
          groupBy={filters.groupBy ?? 'month'}
          loading={loading}
          getCategoryTrendData={getCategoryTrendData}
          getTipoTrendData={getTipoTrendData}
          getLineChartOptions={getLineChartOptions}
          selectedTipo={selectedTipo}
          onTipoChange={handleTipoChange}
          showBreakdown={false}
        />

        <TipoEntriesTable {...tableFilters} />
      </div>
    </div>
  );
}
