// app/analytics/page.tsx
'use client';


import { AnalyticsFilter } from "@/components/analytics-filter";
import { useAnalyticsData } from "@/hooks/use-analytics-data";
import { getTemporalChartData, getCategoryChartData } from "@/lib/analytics-charts";
import { SummaryCards } from "@/components/analytics/SummaryCards";
import { PerActionCards } from "@/components/analytics/PerActionCards";
import { TemporalChart } from "@/components/analytics/TemporalChart";
import { NetTrendChart } from "@/components/analytics/NetTrendChart";
import { CategoryChart } from "@/components/analytics/CategoryChart";


export default function AnalyticsPage() {
  const { data, filters, setFilters, loading } = useAnalyticsData();

  // Compute income - expenses (excluding investments) per period ("balance")
  const netIncomeExpenseLabels = Array.from(new Set(data.temporalData.map(item => item.period))).sort();
  const balance = netIncomeExpenseLabels.map(period => {
    const ingresos = data.temporalData
      .filter(item => item.period === period && item.action === "Ingreso")
      .reduce((sum, item) => sum + Number(item.total || 0), 0);
    const gastos = data.temporalData
      .filter(item => item.period === period && item.action === "Gasto")
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
      const periods = (data.temporalData || []).map(t => new Date(t.period));
      start = new Date(Math.min(...periods.map(p => p.getTime())));
      end = new Date(Math.max(...periods.map(p => p.getTime())));
    }
    if (!start || !end) return 0;
    const startMs = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0).getTime();
    const endMs = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999).getTime();
    const days = Math.max(0, (endMs - startMs) / msPerDay);
    return days / 30;
  })();
  const yearsInRange = monthsInRange / 12;

  // Chart options (can be further extracted if needed)
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: import('chart.js').TooltipItem<'bar'>) => {
            const label = context.label || '';
            const value = context.raw as number;
            const index = context.dataIndex;
            const datasetLabel = context.dataset.label as string;
            const periodIso = (data.temporalData || [])
              .map((td: any) => td.period)
              .sort()[index];
            const match = (data.temporalData || []).find((d: any) => d.action === datasetLabel && d.period === periodIso);
            const countText = match?.count ? ` • ${match.count} mov.` : '';
            return `${label} — ${datasetLabel}: ${value.toFixed(2)} €${countText}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number | string) => `${value} €`
        }
      }
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Analíticas Financieras</h1>
      <div className="mb-6">
        <AnalyticsFilter
          value={filters}
          onChange={setFilters}
          actions={[...new Set(data.temporalData.map(d => d.action))]}
          categories={[...new Set(data.categoryData.map(d => d.category))]}
          platforms={[...new Set([
            ...data.temporalData.map((d: any) => d.platform).filter(Boolean),
            ...data.categoryData.map((d: any) => d.platform).filter(Boolean)
          ])]}
          types={[...new Set([
            ...data.temporalData.map((d: any) => d.type).filter(Boolean),
            ...data.categoryData.map((d: any) => d.type).filter(Boolean)
          ])]}
          years={[2025, 2024, 2023]}
        />
      </div>
      <SummaryCards sums={data.sums} metrics={data.metrics} monthsInRange={monthsInRange} yearsInRange={yearsInRange} />
      <PerActionCards metrics={data.metrics} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TemporalChart data={getTemporalChartData(data, data.metrics?.groupBy || 'month')} options={chartOptions} loading={loading} />
        <NetTrendChart
          data={{
            labels: netIncomeExpenseLabels.map(p => {
              const d = new Date(p);
              return (data.metrics?.groupBy === 'year')
                ? d.getFullYear().toString()
                : d.toLocaleString('es-ES', { month: 'short', year: 'numeric' });
            }),
            datasets: [
              {
                label: 'Neto',
                data: (data.netTemporal || []).map((n: any) => n.net),
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
              }
            ]
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              tooltip: {
                callbacks: {
                  label: (context: any) => {
                    const value = context.raw as number;
                    return `Neto: ${value.toFixed(2)} €`;
                  }
                }
              }
            },
            scales: {
              y: {
                ticks: { callback: (value: number | string) => `${value} €` }
              }
            }
          }}
          loading={loading}
        />
        <CategoryChart
          data={getCategoryChartData(data)}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'right' as const },
              tooltip: {
                callbacks: {
                  label: (context: any) => {
                    const label = context.label || '';
                    const value = context.raw as number;
                    const total = (context.dataset.data as number[]).reduce((a: number, b: number) => a + b, 0);
                    const percentage = Math.round((value / total) * 100);
                    const countsByCategory = (data.categoryData || []).reduce((acc: any, cur: any) => {
                      acc[cur.category] = (acc[cur.category] || 0) + (cur.count || 0);
                      return acc;
                    }, {});
                    const count = countsByCategory[label] || 0;
                    return `${label}: ${value.toFixed(2)} € (${percentage}%) • ${count} mov.`;
                  }
                }
              },
              title: {
                display: true,
                text: `Total: ${getCategoryChartData(data).total.toFixed(2)} €`,
                position: 'top',
              }
            }
          }}
          loading={loading}
        />
      </div>
    </div>
  );
}
