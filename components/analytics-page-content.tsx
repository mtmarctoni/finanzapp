'use client';

import { useMemo } from 'react';

import { CategoryDeepDive } from '@/components/analytics/CategoryDeepDive';
import { IntelligenceExplorer } from '@/components/analytics/IntelligenceExplorer';
import { NetTrendChart } from '@/components/analytics/NetTrendChart';
import { SeasonalExplorer } from '@/components/analytics/SeasonalExplorer';
import { SpendingBreakdown } from '@/components/analytics/SpendingBreakdown';
import { SpendingVelocity } from '@/components/analytics/SpendingVelocity';
import { SummaryCards } from '@/components/analytics/SummaryCards';
import { TemporalChart } from '@/components/analytics/TemporalChart';
import { TopTransactionsTable } from '@/components/analytics/TopTransactionsTable';
import { TrendExplorer } from '@/components/analytics/TrendExplorer';
import { AnalyticsSubnav } from '@/components/analytics/analytics-subnav';
import {
  AnalyticsFilter,
  AnalyticsFilterChips,
  AnalyticsPeriodControl,
} from '@/components/analytics-filter';
import { PageHeader } from '@/components/page-header';
import { useAnalyticsData, type Filters } from '@/hooks/use-analytics-data';
import {
  getTemporalChartData,
  getTemporalChartOptions,
  getLineChartOptions,
  getCategoryPlatformBreakdown,
  getCategoryTrendData,
  computeSpendingVelocity,
  computeTipoSpendingVelocity,
  getTipoTrendData,
} from '@/lib/analytics-charts';

export default function AnalyticsPageContent() {
  const { data, filters, setFilters, loading } = useAnalyticsData();
  const temporalChartData = getTemporalChartData(
    data,
    data.metrics?.groupBy ?? 'month',
  );

  const tipoToQueMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const item of data.tipoQueData) {
      if (!map.has(item.type)) map.set(item.type, new Set());
      map.get(item.type)?.add(item.category);
    }
    return map;
  }, [data.tipoQueData]);

  const netIncomeExpenseLabels = Array.from(
    new Set(data.temporalData.map((item) => item.period)),
  ).sort();
  const balance = netIncomeExpenseLabels.map((period) => {
    const ingresos = data.temporalData
      .filter((item) => item.period === period && item.action === 'Ingreso')
      .reduce((sum, item) => sum + Number(item.total || 0), 0);
    const gastos = data.temporalData
      .filter((item) => item.period === period && item.action === 'Gasto')
      .reduce((sum, item) => sum + Number(item.total || 0), 0);
    return ingresos - Math.abs(gastos);
  });
  const netSeries = data.netTemporal?.length
    ? data.netTemporal.map((n) => n.net)
    : balance;
  const accBalance = netSeries.reduce((acc: number[], curr) => {
    if (acc.length === 0) return [curr];
    acc.push(acc[acc.length - 1] + curr);
    return acc;
  }, []);

  const monthsInRange = (() => {
    const msPerDay = 24 * 60 * 60 * 1000;
    let start: Date | undefined;
    let end: Date | undefined;
    if (filters.from && filters.to) {
      start = new Date(filters.from);
      end = new Date(filters.to);
    } else if (data.temporalData.length > 0) {
      const periods = data.temporalData.map((t) => new Date(t.period));
      start = new Date(Math.min(...periods.map((p) => p.getTime())));
      end = new Date(Math.max(...periods.map((p) => p.getTime())));
    }
    if (!start || !end) return 0;
    const startMs = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
      0,
      0,
      0,
      0,
    ).getTime();
    const endMs = new Date(
      end.getFullYear(),
      end.getMonth(),
      end.getDate(),
      23,
      59,
      59,
      999,
    ).getTime();
    const days = Math.max(0, (endMs - startMs) / msPerDay);
    return days / 30;
  })();
  const yearsInRange = monthsInRange / 12;

  const queVelocities = computeSpendingVelocity(
    data.categoryTemporalData,
    'Gasto',
  );
  const tipoVelocities = computeTipoSpendingVelocity(
    data.typeTemporalData,
    'Gasto',
  );

  // Pickers list tipos by how much was spent in them, so each explorer opens
  // on the most relevant one instead of an empty state.
  const spendByType = new Map<string, number>();
  for (const d of data.typeTemporalData) {
    const add = d.action === 'Gasto' ? Math.abs(Number(d.total)) : 0;
    spendByType.set(d.type, (spendByType.get(d.type) ?? 0) + add);
  }
  const typesWithTemporal = Array.from(spendByType.keys()).sort(
    (a, b) =>
      (spendByType.get(b) ?? 0) - (spendByType.get(a) ?? 0) ||
      a.localeCompare(b),
  );

  // Years for the period presets come from the data (TODOS #4); fall back to
  // the last three calendar years before the first response lands.
  const thisYear = new Date().getFullYear();
  const years = data.availableYears.length
    ? Array.from(new Set(data.availableYears))
        .sort((a, b) => b - a)
        .slice(0, 4)
    : [thisYear, thisYear - 1, thisYear - 2];

  const onFilters = (f: Filters) => setFilters(f);

  return (
    <div className="min-w-0">
      <PageHeader
        title="Análisis"
        actions={
          <AnalyticsPeriodControl
            value={filters}
            onChange={(f) => onFilters(f as Filters)}
            years={years}
          />
        }
      />
      <AnalyticsSubnav
        actions={
          <AnalyticsFilter
            value={filters}
            onChange={(f) => onFilters(f as Filters)}
            actions={[...new Set(data.temporalData.map((d) => d.action))]}
            categories={[...new Set(data.categoryData.map((d) => d.category))]}
            platforms={[
              ...new Set([
                ...data.temporalData.map((d) => d.platform).filter(Boolean),
                ...data.categoryData.map((d) => d.platform).filter(Boolean),
                ...data.platformData.map((d) => d.platform).filter(Boolean),
              ]),
            ]}
            types={[
              ...new Set([
                ...data.temporalData.map((d) => d.type).filter(Boolean),
                ...data.categoryData.map((d) => d.type).filter(Boolean),
                ...data.typeData.map((d) => d.type).filter(Boolean),
                ...data.tipoQueData.map((d) => d.type).filter(Boolean),
                ...data.typeTemporalData.map((d) => d.type).filter(Boolean),
              ]),
            ]}
            years={years}
            tipoToQueMap={tipoToQueMap}
          />
        }
      />
      <div className="mt-2 empty:hidden">
        <AnalyticsFilterChips
          value={filters}
          onChange={(f) => onFilters(f as Filters)}
        />
      </div>

      <div className="mt-5 space-y-3 md:space-y-4">
        <SummaryCards
          sums={data.sums}
          metrics={
            data.metrics as Parameters<typeof SummaryCards>[0]['metrics']
          }
          monthsInRange={monthsInRange}
          yearsInRange={yearsInRange}
          loading={loading}
        />

        <div className="grid gap-3 md:gap-4 lg:grid-cols-2">
          <TemporalChart
            data={temporalChartData}
            options={getTemporalChartOptions(data.temporalData)}
            loading={loading}
          />
          <NetTrendChart
            data={{
              labels: netIncomeExpenseLabels.map((p) => {
                const d = new Date(p);
                return data.metrics?.groupBy === 'year'
                  ? d.getFullYear().toString()
                  : d.toLocaleString('es-ES', {
                      month: 'short',
                      year: 'numeric',
                    });
              }),
              datasets: [
                { label: 'Acumulado', data: accBalance },
                { label: 'Neto del periodo', data: netSeries },
              ],
            }}
            options={getLineChartOptions()}
            loading={loading}
          />
        </div>

        <div className="grid items-start gap-3 md:gap-4 lg:grid-cols-2">
          <SpendingBreakdown
            categoryData={data.categoryData}
            typeData={data.typeData}
            platformData={data.platformData}
            loading={loading}
          />
          <CategoryDeepDive
            categoryData={data.categoryData}
            categoryPlatformData={data.categoryPlatformData}
            getChartData={getCategoryPlatformBreakdown}
            loading={loading}
          />
        </div>

        <TrendExplorer
          categoryTemporalData={data.categoryTemporalData}
          typeTemporalData={data.typeTemporalData}
          tipoQueData={data.tipoQueData}
          types={typesWithTemporal}
          groupBy={data.metrics?.groupBy ?? 'month'}
          loading={loading}
          getCategoryTrendData={getCategoryTrendData}
          getTipoTrendData={getTipoTrendData}
          getLineChartOptions={getLineChartOptions}
        />

        <div className="grid gap-3 md:gap-4 lg:grid-cols-2">
          <SpendingVelocity
            velocities={queVelocities}
            loading={loading}
            title="Velocidad por categoría"
          />
          <SpendingVelocity
            velocities={tipoVelocities}
            loading={loading}
            title="Velocidad por tipo"
          />
        </div>

        <IntelligenceExplorer
          categoryStats={data.categoryStats}
          categoryPlatformData={data.categoryPlatformData}
          categoryData={data.categoryData}
          temporalData={data.temporalData}
          types={typesWithTemporal}
          loading={loading}
        />
        <SeasonalExplorer
          categoryTemporalData={data.categoryTemporalData}
          types={typesWithTemporal}
          loading={loading}
        />

        <TopTransactionsTable
          transactions={data.topTransactions}
          loading={loading}
        />
      </div>
    </div>
  );
}
