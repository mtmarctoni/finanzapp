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
}

export interface AnalyticsDataset {
  temporalData: TemporalDatum[];
  categoryData: CategoryDatum[];
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
  "Inversión": {
    background: "rgba(59, 130, 246, 0.35)",
    border: "rgba(59, 130, 246, 1)",
  },
};

function getActionColors(action: string) {
  return actionColorMap[action] ?? {
    background: "rgba(168, 85, 247, 0.35)",
    border: "rgba(168, 85, 247, 1)",
  };
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function getTemporalChartData(data: AnalyticsDataset, groupBy: "month" | "year") {
  const periods = Array.from(
    new Set(data.temporalData.map((item) => item.period))
  ).sort();
  const actions: string[] = Array.from(
    new Set(data.temporalData.map((item) => item.action))
  );

  const datasets: ChartDataset<"bar", number[]>[] = actions.map(
    (action: string) => {
      const color = getActionColors(action);
      return {
        label: action,
        data: periods.map((period) => {
          const item = data.temporalData.find(
            (d) => d.period === period && d.action === action
          );
          return item ? Math.abs(Number(item.total)) : 0;
        }),
        backgroundColor: color.background,
        borderColor: color.border,
        borderWidth: 1,
      } as ChartDataset<"bar", number[]>;
    }
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
  const categoryTotals = data.categoryData.reduce<Record<string, number>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = 0;
    acc[item.category] += Math.abs(Number(item.total));
    return acc;
  }, {});
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
  const total = sortedData.reduce(
    (sum, item) => sum + item.total,
    0
  );
  return {
    labels: sortedData.map((item) => item.category),
    datasets: [
      {
        data: sortedData.map((item) => item.total),
        backgroundColor: sortedData.map(
          (_, index) => colors[index % colors.length]
        ),
        borderWidth: 1,
      },
    ],
    total,
  };
}

export function getTemporalChartOptions(
  temporalData: TemporalDatum[]
): ChartOptions<"bar"> {
  const sortedPeriods = Array.from(new Set(temporalData.map((item) => item.period))).sort();

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
              (entry) => entry.period === periodIso && entry.action === label
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
          label: (context) => `${context.dataset.label}: ${formatEuro(Number(context.raw || 0))}`,
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
  categoryData: CategoryDatum[]
): ChartOptions<"doughnut"> {
  const countsByCategory = categoryData.reduce<Record<string, number>>((acc, current) => {
    acc[current.category] = (acc[current.category] || 0) + (current.count || 0);
    return acc;
  }, {});

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
            const total = chartValues.reduce((sum, current) => sum + current, 0);
            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
            const count = countsByCategory[label] || 0;
            return `${label}: ${formatEuro(value)} (${percentage}%) • ${count} mov.`;
          },
        },
      },
    },
  };
}
