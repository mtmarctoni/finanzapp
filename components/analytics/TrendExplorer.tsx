'use client';

import { type ChartData, type ChartOptions } from 'chart.js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend as ChartLegend,
} from 'chart.js';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { Line } from 'react-chartjs-2';

import {
  themedLineOptions,
  useChartTheme,
} from '@/components/analytics/chart-theme';
import {
  ActionBadge,
  Amount,
  ChartLoading,
  EmptyState,
  Legend,
  PillSelect,
  RankedBars,
  Section,
} from '@/components/analytics/kit';
import { CategoryTile } from '@/components/quick-add/category-icon';
import {
  type CategoryTemporalDatum,
  type TypeTemporalDatum,
  type TipoQueDatum,
} from '@/lib/analytics-charts';
import { cn } from '@/lib/utils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  ChartLegend,
);

interface TrendExplorerProps {
  categoryTemporalData: CategoryTemporalDatum[];
  typeTemporalData: TypeTemporalDatum[];
  tipoQueData: TipoQueDatum[];
  types: string[];
  groupBy: 'month' | 'year';
  loading: boolean;
  getCategoryTrendData: (
    data: CategoryTemporalDatum[],
    category: string,
    groupBy: 'month' | 'year',
  ) => ChartData<'line', number[], string> & {
    counts?: number[];
    trendSlope?: number;
  };
  getTipoTrendData: (
    data: TypeTemporalDatum[],
    type: string,
    groupBy: 'month' | 'year',
  ) => ChartData<'line', number[], string> & {
    counts?: number[];
    trendSlope?: number;
  };
  getLineChartOptions: () => ChartOptions<'line'>;
  selectedTipo?: string;
  onTipoChange?: (tipo: string) => void;
  /** Hide the per-category ranking when the page already shows one. */
  showBreakdown?: boolean;
}

export function TrendExplorer({
  categoryTemporalData,
  typeTemporalData,
  tipoQueData,
  types,
  groupBy,
  loading,
  getCategoryTrendData,
  getTipoTrendData,
  getLineChartOptions,
  selectedTipo: selectedTipoProp,
  onTipoChange,
  showBreakdown = true,
}: TrendExplorerProps) {
  const theme = useChartTheme();
  const [internalTipo, setInternalTipo] = useState<string>('');
  const [selectedQue, setSelectedQue] = useState<string>('__all__');

  const isControlled =
    selectedTipoProp !== undefined && onTipoChange !== undefined;
  const selectedTipo = isControlled
    ? selectedTipoProp
    : internalTipo || types[0] || '';

  // Build tipo → que mapping
  const tipoToQueMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const item of tipoQueData) {
      if (!map.has(item.type)) map.set(item.type, new Set());
      map.get(item.type)?.add(item.category);
    }
    return map;
  }, [tipoQueData]);

  const availableQue =
    selectedTipo && tipoToQueMap.has(selectedTipo)
      ? Array.from(tipoToQueMap.get(selectedTipo) ?? []).sort()
      : [];

  const handleTipoChange = (tipo: string) => {
    if (isControlled) {
      onTipoChange(tipo);
      setSelectedQue('__all__');
    } else {
      setInternalTipo(tipo);
      setSelectedQue('__all__');
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external-prop resync: a controlled tipo change must reset the internal que filter
    if (isControlled) setSelectedQue('__all__');
  }, [selectedTipo, isControlled]);

  // Determine what chart data to show
  const isTipoOnly = selectedTipo && selectedQue === '__all__';
  const isQue = selectedTipo && selectedQue !== '__all__';

  const chartData = isTipoOnly
    ? getTipoTrendData(typeTemporalData, selectedTipo, groupBy)
    : isQue
      ? getCategoryTrendData(categoryTemporalData, selectedQue, groupBy)
      : null;

  const trendSlope = chartData?.trendSlope ?? 0;
  const trendDirection =
    trendSlope > 0.5 ? 'up' : trendSlope < -0.5 ? 'down' : 'flat';

  // Compute stats
  let totalSpend = 0;
  let dataPoints = 0;
  let avgPerPeriod = 0;

  if (isTipoOnly) {
    const tipoData = typeTemporalData.filter(
      (d) => d.type === selectedTipo && d.action === 'Gasto',
    );
    totalSpend = tipoData.reduce(
      (sum, d) => sum + Math.abs(Number(d.total)),
      0,
    );
    dataPoints = tipoData.length;
    avgPerPeriod = dataPoints > 0 ? totalSpend / dataPoints : 0;
  } else if (isQue) {
    const queData = categoryTemporalData.filter(
      (d) => d.category === selectedQue && d.action === 'Gasto',
    );
    totalSpend = queData.reduce((sum, d) => sum + Math.abs(Number(d.total)), 0);
    dataPoints = queData.length;
    avgPerPeriod = dataPoints > 0 ? totalSpend / dataPoints : 0;
  }

  // Que breakdown for sub-table when tipo is selected
  const queBreakdown = isTipoOnly
    ? tipoQueData
        .filter((d) => d.type === selectedTipo)
        .map((d) => ({
          category: d.category,
          total: Math.abs(Number(d.total)),
          count: d.count ?? 0,
          action: d.action,
        }))
        .sort((a, b) => b.total - a.total)
    : [];

  const tipoTotal = queBreakdown.reduce((sum, d) => sum + d.total, 0);

  const labels = (chartData?.labels ?? []) as string[];
  const seriesColor: Partial<Record<string, string>> = {
    Gasto: theme.foreground,
    Ingreso: theme.positive,
    Tendencia: theme.faint,
  };
  const legendLabel: Partial<Record<string, string>> = {
    Gasto: 'Gastos',
    Ingreso: 'Ingresos',
    Tendencia: 'Tendencia',
  };
  const visibleDatasets = (chartData?.datasets ?? []).filter(
    (d) =>
      d.label === 'Tendencia' ||
      (d.data as number[]).some((v) => Number(v) !== 0),
  );
  const themedData: ChartData<'line', number[], string> = {
    labels,
    datasets: visibleDatasets.map((d) => {
      const color = seriesColor[d.label ?? ''] ?? theme.subtle;
      const isTrend = d.label === 'Tendencia';
      return {
        ...d,
        borderColor: color,
        backgroundColor: color,
        pointBackgroundColor: color,
        fill: false,
        borderWidth: isTrend ? 1.5 : 2,
        borderDash: isTrend ? [4, 4] : undefined,
        pointRadius: isTrend ? 0 : undefined,
      };
    }),
  };

  const unit = groupBy === 'year' ? 'año' : 'mes';
  const stats = [
    {
      label: 'Tendencia',
      value:
        trendDirection === 'up'
          ? 'Subiendo'
          : trendDirection === 'down'
            ? 'Bajando'
            : 'Estable',
      icon:
        trendDirection === 'up'
          ? TrendingUp
          : trendDirection === 'down'
            ? TrendingDown
            : Minus,
      tone: trendDirection === 'down' ? 'text-positive' : '',
      sub: `${trendSlope > 0 ? '+' : ''}${trendSlope.toFixed(0)} €/${unit} de media`,
    },
    {
      label: 'Total gastado',
      value: <Amount amount={totalSpend} />,
    },
    {
      label: `Media por ${unit}`,
      value: <Amount amount={avgPerPeriod} />,
    },
    {
      label: 'Periodos con datos',
      value: String(dataPoints),
    },
  ];

  return (
    <Section
      title="Tendencias"
      description={`Evolución de ${
        selectedQue !== '__all__'
          ? selectedQue
          : selectedTipo || 'todas las categorías'
      }`}
      legend={
        labels.length > 0 && (
          <Legend
            items={visibleDatasets.map((d) => ({
              label: legendLabel[d.label ?? ''] ?? d.label ?? '',
              color: seriesColor[d.label ?? ''] ?? theme.subtle,
              dashed: d.label === 'Tendencia',
            }))}
          />
        )
      }
      action={
        <>
          {!isControlled && (
            <PillSelect
              ariaLabel="Tipo"
              value={selectedTipo}
              onValueChange={handleTipoChange}
              placeholder="Tipo (general)"
              options={types}
            />
          )}
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
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="h-56 min-w-0 md:h-64 lg:col-span-3">
          {loading ? (
            <ChartLoading />
          ) : chartData && labels.length > 0 ? (
            <Line
              data={themedData}
              options={themedLineOptions(theme, labels, getLineChartOptions())}
            />
          ) : (
            <EmptyState className="h-full">
              Selecciona un tipo o categoría para ver la tendencia
            </EmptyState>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-hairline pt-4 lg:grid-cols-1 lg:content-start lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="min-w-0">
                <dt className="text-[12px] text-faint">{stat.label}</dt>
                <dd
                  className={cn(
                    'num mt-0.5 flex items-center gap-1.5 truncate text-[17px] font-semibold tracking-[-0.02em]',
                    stat.tone,
                  )}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  {stat.value}
                </dd>
                {stat.sub && (
                  <dd className="num mt-0.5 text-[12px] text-faint">
                    {stat.sub}
                  </dd>
                )}
              </div>
            );
          })}
        </dl>
      </div>

      {/* Que breakdown when a whole tipo is selected */}
      {showBreakdown && isTipoOnly && queBreakdown.length > 0 && (
        <div className="mt-5 border-t border-hairline pt-4">
          <h3 className="mb-1 text-[13px] font-semibold text-subtle">
            Categorías dentro de {selectedTipo}
          </h3>
          <RankedBars
            ariaLabel={`Categorías dentro de ${selectedTipo}`}
            shareLabel="del tipo"
            limit={5}
            items={queBreakdown.map((item) => ({
              key: `${item.category}-${item.action}`,
              label: item.category,
              value: item.total,
              pct: tipoTotal > 0 ? (item.total / tipoTotal) * 100 : 0,
              count: item.count,
              icon: <CategoryTile name={item.category} />,
              badge: <ActionBadge action={item.action} />,
              tone:
                item.action === 'Ingreso'
                  ? 'positive'
                  : item.action === 'Inversión'
                    ? 'invest'
                    : 'neutral',
            }))}
          />
        </div>
      )}
    </Section>
  );
}
