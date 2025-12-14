import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChartData, ChartDataset } from "chart.js";

export function getTemporalChartData(data: any, groupBy: "month" | "year") {
  const periods = Array.from(
    new Set(data.temporalData.map((item: any) => item.period))
  ).sort();
  const actions: string[] = Array.from(
    new Set(data.temporalData.map((item: any) => item.action))
  );

  const datasets: ChartDataset<"bar", number[]>[] = actions.map(
    (action: string) => {
      const color =
        action === "Ingreso"
          ? "rgba(75, 192, 192, 0.6)"
          : action === "Gasto"
          ? "rgba(255, 99, 132, 0.6)"
          : "rgba(54, 162, 235, 0.6)";
      return {
        label: action,
        data: periods.map((period) => {
          const item = data.temporalData.find(
            (d: any) => d.period === period && d.action === action
          );
          return item ? Math.abs(item.total) : 0;
        }),
        backgroundColor: color,
        borderColor: color.replace("0.6", "1"),
        borderWidth: 1,
      } as ChartDataset<"bar", number[]>;
    }
  );

  if (datasets.length > 0) {
    const totalData = periods.map((period) => {
      return data.temporalData
        .filter((item: any) => item.period === period)
        .reduce((sum: number, item: any) => sum + Math.abs(item.total), 0);
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

export function getCategoryChartData(data: any) {
  const categoryTotals = data.categoryData.reduce((acc: any, item: any) => {
    if (!acc[item.category]) acc[item.category] = 0;
    acc[item.category] += Math.abs(item.total);
    return acc;
  }, {});
  const sortedData = Object.entries(categoryTotals)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => (b.total as number) - (a.total as number));
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
    (sum, item) => sum + (item.total as number),
    0
  );
  return {
    labels: sortedData.map((item) => item.category),
    datasets: [
      {
        data: sortedData.map((item) => item.total as number),
        backgroundColor: sortedData.map(
          (_, index) => colors[index % colors.length]
        ),
        borderWidth: 1,
      },
    ],
    total,
  };
}
