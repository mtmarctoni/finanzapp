'use client';

import { useMemo } from 'react';

import { CategoryChart } from '@/components/analytics/CategoryChart';
import { CategoryDeepDive } from '@/components/analytics/CategoryDeepDive';
import { IntelligenceExplorer } from '@/components/analytics/IntelligenceExplorer';
import { NetTrendChart } from '@/components/analytics/NetTrendChart';
import { PerActionCards } from '@/components/analytics/PerActionCards';
import { PlatformChart } from '@/components/analytics/PlatformChart';
import { SavingsRateCard } from '@/components/analytics/SavingsRateCard';
import { SeasonalExplorer } from '@/components/analytics/SeasonalExplorer';
import { SpendingVelocity } from '@/components/analytics/SpendingVelocity';
import { SummaryCards } from '@/components/analytics/SummaryCards';
import { TemporalChart } from '@/components/analytics/TemporalChart';
import { TipoExplorer } from '@/components/analytics/TipoExplorer';
import { TopTransactionsTable } from '@/components/analytics/TopTransactionsTable';
import { TrendExplorer } from '@/components/analytics/TrendExplorer';
import { TypeChart } from '@/components/analytics/TypeChart';
import { AnalyticsFilter } from '@/components/analytics-filter';
import { useAnalyticsData, type Filters } from '@/hooks/use-analytics-data';
import {
  getTemporalChartData,
  getCategoryChartData,
  getTemporalChartOptions,
  getLineChartOptions,
  getDoughnutChartOptions,
  getPlatformChartData,
  getPlatformChartOptions,
  getTypeChartData,
  getTypeChartOptions,
  getCategoryPlatformBreakdown,
  getCategoryPlatformChartOptions,
  getCategoryTrendData,
  computeSpendingVelocity,
  computeTipoSpendingVelocity,
  getSeasonalChartData,
  getSeasonalChartOptions,
  getTipoExplorerData,
  getTipoExplorerChartOptions,
  getTipoTrendData,
} from '@/lib/analytics-charts';

export default function AnalyticsPageContent() {
  const { data, filters, setFilters, loading } = useAnalyticsData();
  const temporalChartData = getTemporalChartData(
    data,
    data.metrics?.groupBy || 'month',
  );
  const categoryChartData = getCategoryChartData(data);
  const platformChartData = getPlatformChartData(data.platformData);
  const typeChartData = getTypeChartData(data.typeData);

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
  const accBalance = balance.reduce((acc: number[], curr) => {
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
    } else if ((data.temporalData || []).length > 0) {
      const periods = (data.temporalData || []).map((t) => new Date(t.period));
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

  const typesWithTemporal = Array.from(
    new Set(data.typeTemporalData.map((d) => d.type)),
  ).sort();

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Analíticas Financieras</h1>
      <div className="mb-6">
        <AnalyticsFilter
          value={filters}
          onChange={(f) => setFilters(f as Filters)}
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
          years={[2025, 2024, 2023]}
          tipoToQueMap={tipoToQueMap}
        />
      </div>

      <SummaryCards
        sums={data.sums}
        metrics={data.metrics as Parameters<typeof SummaryCards>[0]['metrics']}
        monthsInRange={monthsInRange}
        yearsInRange={yearsInRange}
      />
      <PerActionCards
        metrics={
          data.metrics as Parameters<typeof PerActionCards>[0]['metrics']
        }
      />
      <div className="mb-6 max-w-sm">
        <SavingsRateCard
          income={data.sums.ingresos}
          expenses={data.sums.gastos}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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
              {
                label: 'Neto',
                data: (data.netTemporal || []).map((n) => n.net),
                borderColor: 'rgba(99, 102, 241, 1)',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
              },
              {
                label: 'Balance',
                data: balance,
                borderColor: 'rgba(34,197,94,1)',
                backgroundColor: 'rgba(34,197,94,0.1)',
                borderDash: [6, 3],
              },
              {
                label: 'Acc Balance',
                data: accBalance,
                borderColor: 'rgba(234,179,8,1)',
                backgroundColor: 'rgba(234,179,8,0.1)',
                borderDash: [2, 2],
              },
            ],
          }}
          options={getLineChartOptions()}
          loading={loading}
        />
        <CategoryChart
          data={categoryChartData}
          options={getDoughnutChartOptions(
            categoryChartData.total,
            data.categoryData,
          )}
          loading={loading}
        />
        <PlatformChart
          data={platformChartData}
          options={getPlatformChartOptions()}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <TypeChart
          data={typeChartData}
          options={getTypeChartOptions()}
          loading={loading}
        />
        <CategoryDeepDive
          categoryData={data.categoryData}
          categoryPlatformData={data.categoryPlatformData}
          getChartData={getCategoryPlatformBreakdown}
          getChartOptions={getCategoryPlatformChartOptions}
          loading={loading}
        />
      </div>

      <div className="mb-6">
        <TipoExplorer
          tipoQueData={data.tipoQueData}
          types={typesWithTemporal}
          getChartData={getTipoExplorerData}
          getChartOptions={getTipoExplorerChartOptions}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6">
        <TrendExplorer
          categoryTemporalData={data.categoryTemporalData}
          typeTemporalData={data.typeTemporalData}
          tipoQueData={data.tipoQueData}
          types={typesWithTemporal}
          groupBy={data.metrics?.groupBy || 'month'}
          loading={loading}
          getCategoryTrendData={getCategoryTrendData}
          getTipoTrendData={getTipoTrendData}
          getLineChartOptions={getLineChartOptions}
        />
        <SpendingVelocity
          velocities={queVelocities}
          loading={loading}
          title="Velocidad por Categoría"
        />
        <SpendingVelocity
          velocities={tipoVelocities}
          loading={loading}
          title="Velocidad por Tipo"
        />
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
          getChartData={getSeasonalChartData}
          getChartOptions={getSeasonalChartOptions}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <TopTransactionsTable
          transactions={data.topTransactions}
          loading={loading}
        />
      </div>
    </div>
  );
}
