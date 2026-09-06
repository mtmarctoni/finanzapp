'use client';

import { Chart as ChartJS, ArcElement, Legend, Tooltip } from 'chart.js';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';

import { SavingsRateCard } from '@/components/analytics/SavingsRateCard';
import { SpendingVelocity } from '@/components/analytics/SpendingVelocity';
import { TipoExplorer } from '@/components/analytics/TipoExplorer';
import { TrendExplorer } from '@/components/analytics/TrendExplorer';
import { AnalyticsSubnav } from '@/components/analytics/analytics-subnav';
import { TipoEntriesTable } from '@/components/analytics/tipo-entries-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAnalyticsData } from '@/hooks/use-analytics-data';
import {
  computeMonthlyAverages,
  computeSpendingVelocity,
  getCategoryTrendData,
  getDoughnutChartOptions,
  getLineChartOptions,
  getTipoExplorerChartOptions,
  getTipoExplorerData,
  getTipoQueDoughnutData,
  getTipoTrendData,
} from '@/lib/analytics-charts';
import { cn, formatCurrency } from '@/lib/utils';

ChartJS.register(ArcElement, Tooltip, Legend);

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

interface ChipRowProps {
  label: string;
  options: { value: string; label: string }[];
  active: string;
  onSelect: (value: string) => void;
}

function ChipRow({ label, options, active, onSelect }: ChipRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground w-14 shrink-0">
        {label}
      </span>
      {options.map((option) => (
        <Button
          key={option.value}
          variant={active === option.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelect(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
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

  const doughnutData = getTipoQueDoughnutData(data.tipoQueData, selectedTipo);
  const doughnutOptions = getDoughnutChartOptions(
    doughnutData.total,
    doughnutData.labels.map((label, index) => ({
      category: label,
      action: 'Gasto',
      total: doughnutData.datasets[0].data[index],
      count: 0,
    })),
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

  const summaryCards = [
    {
      label: 'Gastos',
      amount: perAction.Gasto.amount,
      count: perAction.Gasto.count,
      accent: 'text-destructive',
      average: hasAverage ? (averageByAction.get('Gasto') ?? 0) : null,
    },
    {
      label: 'Inversión',
      amount: perAction.Inversión.amount,
      count: perAction.Inversión.count,
      accent: 'text-blue-600',
      average: hasAverage ? (averageByAction.get('Inversión') ?? 0) : null,
    },
    {
      label: 'Ingresos',
      amount: perAction.Ingreso.amount,
      count: perAction.Ingreso.count,
      accent: 'text-green-600',
      average: hasAverage ? (averageByAction.get('Ingreso') ?? 0) : null,
    },
    {
      label: 'Neto',
      amount: Math.abs(net),
      count: null,
      accent: net >= 0 ? 'text-green-600' : 'text-destructive',
      average: netAverage,
    },
  ];

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Analíticas por Tipo</h1>
      <div className="mb-6">
        <AnalyticsSubnav />
      </div>

      <div className="space-y-3 mb-6">
        <ChipRow
          label="Tipo"
          options={tipos.map((tipo) => ({ value: tipo, label: tipo }))}
          active={selectedTipo}
          onSelect={handleTipoChange}
        />
        {queOptions.length > 0 && (
          <ChipRow
            label="Que"
            options={[
              { value: 'todos', label: 'Todos' },
              ...queOptions.map((que) => ({ value: que, label: que })),
            ]}
            active={selectedQue}
            onSelect={setSelectedQue}
          />
        )}
        <ChipRow
          label="Periodo"
          options={[
            { value: 'all', label: 'Todo' },
            ...years.map((year) => ({
              value: `year-${year}`,
              label: String(year),
            })),
            ...(activeYear
              ? MONTHS.map((month, index) => ({
                  value: `month-${index + 1}`,
                  label: month,
                }))
              : []),
          ]}
          active={
            activeMonth > 0
              ? `month-${activeMonth}`
              : fromStr
                ? `year-${activeYear}`
                : 'all'
          }
          onSelect={(value) => {
            if (value === 'all') handlePeriod(null, null);
            else if (value.startsWith('year-')) {
              const year = Number(value.slice(5));
              handlePeriod(`${year}-01-01`, `${year}-12-31`);
            } else if (value.startsWith('month-')) {
              const month = Number(value.slice(6));
              const pad = String(month).padStart(2, '0');
              const year = activeYear;
              handlePeriod(
                `${year}-${pad}-01`,
                `${year}-${pad}-${String(lastDayOfMonth(year, month - 1)).padStart(2, '0')}`,
              );
            }
          }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn('text-2xl font-bold', card.accent)}>
                {formatCurrency(card.amount)}
              </div>
              {card.count !== null && (
                <div className="text-sm text-muted-foreground">
                  {card.count} mov.
                </div>
              )}
              {card.average !== null && (
                <div
                  className="text-sm text-muted-foreground"
                  title="Promedio por mes de calendario entre el primer y el último movimiento; los meses sin movimientos cuentan como 0."
                >
                  {formatCurrency(card.average)}/mes
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Gasto por Categoría</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : doughnutData.labels.length > 0 ? (
              <Doughnut data={doughnutData} options={doughnutOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No hay datos disponibles
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <SavingsRateCard
            income={perAction.Ingreso.amount}
            expenses={perAction.Gasto.amount}
          />
          <SpendingVelocity
            velocities={queVelocities}
            loading={loading}
            title={`Velocidad de Gasto en ${selectedTipo}`}
          />
        </div>
      </div>

      <div className="mb-6">
        <TipoExplorer
          tipoQueData={data.tipoQueData}
          types={tipos}
          getChartData={getTipoExplorerData}
          getChartOptions={getTipoExplorerChartOptions}
          loading={loading}
          selectedTipo={selectedTipo}
          onTipoChange={handleTipoChange}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6">
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
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <TipoEntriesTable {...tableFilters} />
      </div>
    </div>
  );
}
