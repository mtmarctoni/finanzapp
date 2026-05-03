import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChartData, ChartDataset, ChartOptions } from "chart.js";

export interface TemporalDatum {
  period: string;
  action: string;
  total: number;
  count?: number;
  platform?: string | null;
  type?: string | null;
}

export interface CategoryDatum {
  category: string;
  total: number;
  count?: number;
  platform?: string | null;
  type?: string | null;
  action?: string | null;
}

export interface PlatformDatum {
  platform: string;
  action: string;
  total: number;
  count?: number;
}

export interface TypeDatum {
  type: string;
  action: string;
  total: number;
  count?: number;
}

export interface TopTransactionDatum {
  id: string;
  fecha: string;
  tipo: string;
  action: string;
  category: string;
  platform: string;
  amount: number;
  detalle1: string | null;
  detalle2: string | null;
  quien: string;
}

export interface CategoryPlatformDatum {
  category: string;
  platform: string;
  total: number;
  count?: number;
}

export interface TipoQueDatum {
  type: string;
  category: string;
  action: string;
  total: number;
  count?: number;
}

export interface CategoryTemporalDatum {
  period: string;
  category: string;
  action: string;
  total: number;
  count?: number;
}

export interface CategoryStatDatum {
  category: string;
  action: string;
  avg: number;
  min: number;
  max: number;
  count: number;
}

export interface AnalyticsDataset {
  temporalData: TemporalDatum[];
  categoryData: CategoryDatum[];
  platformData: PlatformDatum[];
  typeData: TypeDatum[];
  topTransactions: TopTransactionDatum[];
  categoryPlatformData: CategoryPlatformDatum[];
  tipoQueData: TipoQueDatum[];
  categoryTemporalData: CategoryTemporalDatum[];
  categoryStats: CategoryStatDatum[];
}

const actionColorMap: Record<string, { background: string; border: string }> = {
  Ingreso: {
    background: "rgba(34, 197, 94, 0.35)",
    border: "rgba(34, 197, 94, 1)",
  },
  Gasto: {
    background: "rgba(239, 68, 68, 0.35)",
    border: "rgba(239, 68, 68, 1)",
  },
  Inversión: {
    background: "rgba(59, 130, 246, 0.35)",
    border: "rgba(59, 130, 246, 1)",
  },
};

function getActionColors(action: string) {
  return (
    actionColorMap[action] ?? {
      background: "rgba(168, 85, 247, 0.35)",
      border: "rgba(168, 85, 247, 1)",
    }
  );
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function getTemporalChartData(
  data: AnalyticsDataset,
  groupBy: "month" | "year",
) {
  const periods = Array.from(
    new Set(data.temporalData.map((item) => item.period)),
  ).sort();
  const actions: string[] = Array.from(
    new Set(data.temporalData.map((item) => item.action)),
  );

  const datasets: ChartDataset<"bar", number[]>[] = actions.map(
    (action: string) => {
      const color = getActionColors(action);
      return {
        label: action,
        data: periods.map((period) => {
          const item = data.temporalData.find(
            (d) => d.period === period && d.action === action,
          );
          return item ? Math.abs(Number(item.total)) : 0;
        }),
        backgroundColor: color.background,
        borderColor: color.border,
        borderWidth: 1,
      } as ChartDataset<"bar", number[]>;
    },
  );

  if (datasets.length > 0) {
    const totalData = periods.map((period) => {
      return data.temporalData
        .filter((item) => item.period === period)
        .reduce((sum, item) => sum + Math.abs(Number(item.total)), 0);
    });
    datasets.push({
      label: "Total",
      data: totalData,
      backgroundColor: "rgba(201, 203, 207, 0.6)",
      borderColor: "rgba(201, 203, 207, 1)",
      borderWidth: 1,
      borderDash: [5, 5],
      borderDashOffset: 0,
    } as ChartDataset<"bar", number[]>);
  }

  return {
    labels: periods.map((p) => {
      const d = new Date(p as string);
      return groupBy === "year"
        ? format(d, "yyyy", { locale: es })
        : format(d, "MMM yyyy", { locale: es });
    }),
    datasets,
  } as ChartData<"bar", number[], string>;
}

export function getCategoryChartData(data: AnalyticsDataset) {
  const categoryTotals = data.categoryData.reduce<Record<string, number>>(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = 0;
      acc[item.category] += Math.abs(Number(item.total));
      return acc;
    },
    {},
  );
  const sortedData = Object.entries(categoryTotals)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
  const colors = [
    "#FF6384",
    "#36A2EB",
    "#FFCE56",
    "#4BC0C0",
    "#9966FF",
    "#FF9F40",
    "#8AC24A",
    "#FF5252",
    "#607D8B",
    "#9C27B0",
  ];
  const total = sortedData.reduce((sum, item) => sum + item.total, 0);
  return {
    labels: sortedData.map((item) => item.category),
    datasets: [
      {
        data: sortedData.map((item) => item.total),
        backgroundColor: sortedData.map(
          (_, index) => colors[index % colors.length],
        ),
        borderWidth: 1,
      },
    ],
    total,
  };
}

export function getTemporalChartOptions(
  temporalData: TemporalDatum[],
): ChartOptions<"bar"> {
  const sortedPeriods = Array.from(
    new Set(temporalData.map((item) => item.period)),
  ).sort();

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || "";
            const value = Number(context.raw || 0);
            const periodIso = sortedPeriods[context.dataIndex];
            const match = temporalData.find(
              (entry) => entry.period === periodIso && entry.action === label,
            );
            const countText = match?.count ? ` • ${match.count} mov.` : "";
            return `${label}: ${formatEuro(value)}${countText}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => formatEuro(Number(value)),
        },
      },
    },
  };
}

export function getLineChartOptions(): ChartOptions<"line"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) =>
            `${context.dataset.label}: ${formatEuro(Number(context.raw || 0))}`,
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (value) => formatEuro(Number(value)),
        },
      },
    },
  };
}

export function getDoughnutChartOptions(
  totalAmount: number,
  categoryData: CategoryDatum[],
): ChartOptions<"doughnut"> {
  const countsByCategory = categoryData.reduce<Record<string, number>>(
    (acc, current) => {
      acc[current.category] =
        (acc[current.category] || 0) + (current.count || 0);
      return acc;
    },
    {},
  );

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "right" },
      title: {
        display: true,
        text: `Total: ${formatEuro(totalAmount)}`,
        position: "top",
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || "";
            const value = Number(context.raw || 0);
            const chartValues = context.dataset.data as number[];
            const total = chartValues.reduce(
              (sum, current) => sum + current,
              0,
            );
            const percentage =
              total > 0 ? Math.round((value / total) * 100) : 0;
            const count = countsByCategory[label] || 0;
            return `${label}: ${formatEuro(value)} (${percentage}%) • ${count} mov.`;
          },
        },
      },
    },
  };
}

export function getPlatformChartData(platformData: PlatformDatum[]) {
  // Aggregate by platform across all actions (show absolute spending)
  const platformTotals = platformData.reduce<Record<string, { total: number; count: number }>>(
    (acc, item) => {
      if (!acc[item.platform]) acc[item.platform] = { total: 0, count: 0 };
      acc[item.platform].total += Math.abs(Number(item.total));
      acc[item.platform].count += Number(item.count || 0);
      return acc;
    },
    {},
  );

  const sorted = Object.entries(platformTotals)
    .map(([platform, { total, count }]) => ({ platform, total, count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10); // Top 10 platforms

  const colors = [
    "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF",
    "#FF9F40", "#8AC24A", "#FF5252", "#607D8B", "#9C27B0",
  ];

  return {
    labels: sorted.map((item) => item.platform),
    datasets: [
      {
        label: "Total",
        data: sorted.map((item) => item.total),
        backgroundColor: sorted.map((_, index) => colors[index % colors.length]),
        borderWidth: 1,
      },
    ],
    details: sorted,
  };
}

export function getPlatformChartOptions(): ChartOptions<"bar"> {
  return {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = Number(context.raw || 0);
            return `${context.dataset.label}: ${formatEuro(value)}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          callback: (value) => formatEuro(Number(value)),
        },
      },
    },
  };
}

export function getTypeChartData(typeData: TypeDatum[]) {
  // Aggregate by type across all actions
  const typeTotals = typeData.reduce<Record<string, { total: number; count: number }>>(
    (acc, item) => {
      if (!acc[item.type]) acc[item.type] = { total: 0, count: 0 };
      acc[item.type].total += Math.abs(Number(item.total));
      acc[item.type].count += Number(item.count || 0);
      return acc;
    },
    {},
  );

  const sorted = Object.entries(typeTotals)
    .map(([type, { total, count }]) => ({ type, total, count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  const colors = [
    "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF",
    "#FF9F40", "#8AC24A", "#FF5252", "#607D8B", "#9C27B0",
    "#3F51B5", "#E91E63",
  ];

  return {
    labels: sorted.map((item) => item.type),
    datasets: [
      {
        label: "Total",
        data: sorted.map((item) => item.total),
        backgroundColor: sorted.map((_, index) => colors[index % colors.length]),
        borderWidth: 1,
      },
    ],
    details: sorted,
  };
}

export function getTypeChartOptions(): ChartOptions<"bar"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = Number(context.raw || 0);
            return `${context.dataset.label}: ${formatEuro(value)}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => formatEuro(Number(value)),
        },
      },
    },
  };
}

export function getCategoryPlatformBreakdown(
  categoryPlatformData: CategoryPlatformDatum[],
  selectedCategory: string,
) {
  const filtered = categoryPlatformData.filter(
    (item) => item.category === selectedCategory,
  );

  const sorted = filtered
    .map((item) => ({
      platform: item.platform,
      total: Math.abs(Number(item.total)),
      count: Number(item.count || 0),
    }))
    .sort((a, b) => b.total - a.total);

  const colors = [
    "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF",
    "#FF9F40", "#8AC24A", "#FF5252", "#607D8B", "#9C27B0",
  ];

  return {
    labels: sorted.map((item) => item.platform),
    datasets: [
      {
        label: "Gasto",
        data: sorted.map((item) => item.total),
        backgroundColor: sorted.map((_, index) => colors[index % colors.length]),
        borderWidth: 1,
      },
    ],
    details: sorted,
  };
}

export function getCategoryPlatformChartOptions(): ChartOptions<"bar"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = Number(context.raw || 0);
            return `${context.dataset.label}: ${formatEuro(value)}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => formatEuro(Number(value)),
        },
      },
    },
  };
}

// ─── TIPO × QUE BREAKDOWN ───

export function getTipoQueBreakdown(
  tipoQueData: TipoQueDatum[],
  selectedType: string,
) {
  const filtered = tipoQueData.filter((item) => item.type === selectedType);

  const sorted = filtered
    .map((item) => ({
      category: item.category,
      total: Math.abs(Number(item.total)),
      count: Number(item.count || 0),
      action: item.action,
    }))
    .sort((a, b) => b.total - a.total);

  const colors = [
    "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF",
    "#FF9F40", "#8AC24A", "#FF5252", "#607D8B", "#9C27B0",
    "#3F51B5", "#E91E63",
  ];

  return {
    labels: sorted.map((item) => item.category),
    datasets: [
      {
        label: "Total",
        data: sorted.map((item) => item.total),
        backgroundColor: sorted.map((_, index) => colors[index % colors.length]),
        borderWidth: 1,
      },
    ],
    details: sorted,
  };
}

export function getTipoQueChartOptions(): ChartOptions<"bar"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = Number(context.raw || 0);
            return `${context.dataset.label}: ${formatEuro(value)}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => formatEuro(Number(value)),
        },
      },
    },
  };
}

// ─── CATEGORY TREND TRACKER ───

export function getCategoryTrendData(
  categoryTemporalData: CategoryTemporalDatum[],
  selectedCategory: string,
  groupBy: "month" | "year",
) {
  const filtered = categoryTemporalData.filter(
    (item) => item.category === selectedCategory,
  );

  const periods = Array.from(
    new Set(filtered.map((item) => item.period)),
  ).sort();

  const gastos = periods.map((period) => {
    const item = filtered.find(
      (d) => d.period === period && d.action === "Gasto",
    );
    return item ? Math.abs(Number(item.total)) : 0;
  });

  const ingresos = periods.map((period) => {
    const item = filtered.find(
      (d) => d.period === period && d.action === "Ingreso",
    );
    return item ? Math.abs(Number(item.total)) : 0;
  });

  const counts = periods.map((period) => {
    return filtered
      .filter((d) => d.period === period)
      .reduce((sum, d) => sum + (d.count || 0), 0);
  });

  // Simple linear regression on gastos to show trend
  const n = gastos.length;
  let trendSlope = 0;
  if (n > 1) {
    const sumX = gastos.reduce((sum, _, i) => sum + i, 0);
    const sumY = gastos.reduce((sum, v) => sum + v, 0);
    const sumXY = gastos.reduce((sum, v, i) => sum + i * v, 0);
    const sumXX = gastos.reduce((sum, _, i) => sum + i * i, 0);
    trendSlope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  // Trend line data
  const trendLine = gastos.map((_, i) => {
    const sumY = gastos.reduce((sum, v) => sum + v, 0);
    const avgY = sumY / n;
    return avgY + trendSlope * (i - (n - 1) / 2);
  });

  return {
    labels: periods.map((p) => {
      const d = new Date(p as string);
      return groupBy === "year"
        ? format(d, "yyyy", { locale: es })
        : format(d, "MMM yyyy", { locale: es });
    }),
    datasets: [
      {
        label: "Gasto",
        data: gastos,
        borderColor: "rgba(239, 68, 68, 1)",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        fill: true,
        tension: 0.3,
      },
      {
        label: "Ingreso",
        data: ingresos,
        borderColor: "rgba(34, 197, 94, 1)",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        fill: true,
        tension: 0.3,
      },
      {
        label: "Tendencia",
        data: trendLine,
        borderColor: "rgba(168, 85, 247, 1)",
        backgroundColor: "rgba(168, 85, 247, 0)",
        borderDash: [6, 3],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
      },
    ],
    counts,
    trendSlope,
  };
}

export function getCategoryTrendChartOptions(): ChartOptions<"line"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = Number(context.raw || 0);
            return `${context.dataset.label}: ${formatEuro(value)}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => formatEuro(Number(value)),
        },
      },
    },
  };
}

// ─── SPENDING VELOCITY (MoM change) ───

export interface VelocityItem {
  category: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  direction: "up" | "down" | "flat";
}

export function computeSpendingVelocity(
  categoryTemporalData: CategoryTemporalDatum[],
  action: string = "Gasto",
): VelocityItem[] {
  const filtered = categoryTemporalData.filter((item) => item.action === action);

  // Group by category and period
  const byCategory = new Map<string, Map<string, number>>();
  for (const item of filtered) {
    if (!byCategory.has(item.category)) {
      byCategory.set(item.category, new Map());
    }
    byCategory.get(item.category)!.set(item.period, Math.abs(Number(item.total)));
  }

  const velocities: VelocityItem[] = [];
  for (const [category, periodMap] of byCategory) {
    const periods = Array.from(periodMap.keys()).sort();
    if (periods.length < 2) continue;

    const current = periodMap.get(periods[periods.length - 1]) || 0;
    const previous = periodMap.get(periods[periods.length - 2]) || 0;

    const change = current - previous;
    const changePercent = previous > 0 ? (change / previous) * 100 : 0;

    velocities.push({
      category,
      current,
      previous,
      change,
      changePercent,
      direction: change > 0.01 ? "up" : change < -0.01 ? "down" : "flat",
    });
  }

  return velocities.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
}

// ─── SEASONAL PATTERNS ───

export interface SeasonalItem {
  month: number;
  monthName: string;
  total: number;
  count: number;
}

export function getSeasonalPatterns(
  categoryTemporalData: CategoryTemporalDatum[],
  selectedCategory: string,
  action: string = "Gasto",
): SeasonalItem[] {
  const filtered = categoryTemporalData.filter(
    (item) => item.category === selectedCategory && item.action === action,
  );

  const monthNames = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];

  // Aggregate by calendar month across all years
  const byMonth = new Map<number, { total: number; count: number; yearCount: number }>();
  for (let i = 0; i < 12; i++) {
    byMonth.set(i, { total: 0, count: 0, yearCount: 0 });
  }

  for (const item of filtered) {
    const d = new Date(item.period);
    const month = d.getUTCMonth();
    const existing = byMonth.get(month)!;
    existing.total += Math.abs(Number(item.total));
    existing.count += item.count || 0;
    existing.yearCount += 1;
  }

  return Array.from(byMonth.entries()).map(([month, data]) => ({
    month,
    monthName: monthNames[month],
    total: data.yearCount > 0 ? data.total / data.yearCount : 0, // average per year
    count: data.yearCount > 0 ? Math.round(data.count / data.yearCount) : 0,
  }));
}

export function getSeasonalChartData(seasonalData: SeasonalItem[]) {
  const colors = seasonalData.map((item) => {
    const max = Math.max(...seasonalData.map((d) => d.total));
    const intensity = max > 0 ? item.total / max : 0;
    return `rgba(239, 68, 68, ${0.3 + intensity * 0.7})`;
  });

  return {
    labels: seasonalData.map((item) => item.monthName),
    datasets: [
      {
        label: "Promedio mensual",
        data: seasonalData.map((item) => item.total),
        backgroundColor: colors,
        borderColor: "rgba(239, 68, 68, 0.8)",
        borderWidth: 1,
      },
    ],
  };
}

export function getSeasonalChartOptions(): ChartOptions<"bar"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = Number(context.raw || 0);
            return `${context.dataset.label}: ${formatEuro(value)}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => formatEuro(Number(value)),
        },
      },
    },
  };
}
