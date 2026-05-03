import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar } from 'react-chartjs-2';
import { ChartData, ChartOptions } from 'chart.js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { SeasonalItem } from "@/lib/analytics-charts";
import { Sun, Snowflake, Leaf, Flower2 } from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface SeasonalPatternsProps {
  categories: string[];
  getSeasonalData: (category: string) => SeasonalItem[];
  getChartData: (data: SeasonalItem[]) => ChartData<'bar', number[], string>;
  getChartOptions: () => ChartOptions<'bar'>;
  loading: boolean;
}

export function SeasonalPatterns({
  categories,
  getSeasonalData,
  getChartData,
  getChartOptions,
  loading,
}: SeasonalPatternsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(
    categories[0] || "",
  );

  const seasonalData = getSeasonalData(selectedCategory);
  const chartData = getChartData(seasonalData);
  const chartOptions = getChartOptions();

  // Find peak and low months
  const sorted = [...seasonalData].sort((a, b) => b.total - a.total);
  const peakMonth = sorted[0];
  const lowMonth = sorted[sorted.length - 1];

  // Season totals
  const seasons = [
    {
      name: "Invierno",
      months: [11, 0, 1],
      icon: Snowflake,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      name: "Primavera",
      months: [2, 3, 4],
      icon: Flower2,
      color: "text-green-500",
      bg: "bg-green-50",
    },
    {
      name: "Verano",
      months: [5, 6, 7],
      icon: Sun,
      color: "text-amber-500",
      bg: "bg-amber-50",
    },
    {
      name: "Otoño",
      months: [8, 9, 10],
      icon: Leaf,
      color: "text-orange-500",
      bg: "bg-orange-50",
    },
  ];

  const seasonTotals = seasons.map((season) => {
    const total = seasonalData
      .filter((s) => season.months.includes(s.month))
      .reduce((sum, s) => sum + s.total, 0);
    return { ...season, total };
  });

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>Patrones Estacionales</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            ¿En qué meses gastas más en <span className="font-semibold">{selectedCategory}</span>?
          </p>
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Selecciona categoría" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (chartData?.labels?.length ?? 0) > 0 ? (
              <Bar data={chartData} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No hay datos estacionales para esta categoría
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* Peak/Low */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                <div className="text-xs text-red-600 font-medium mb-1">Pico</div>
                <div className="text-lg font-bold text-red-700">{peakMonth?.monthName}</div>
                <div className="text-xs text-red-600">
                  {peakMonth?.total.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-green-50 border border-green-100">
                <div className="text-xs text-green-600 font-medium mb-1">Valle</div>
                <div className="text-lg font-bold text-green-700">{lowMonth?.monthName}</div>
                <div className="text-xs text-green-600">
                  {lowMonth?.total.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                </div>
              </div>
            </div>

            {/* Season totals */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Por estación
              </h4>
              {seasonTotals.map((season) => {
                const Icon = season.icon;
                return (
                  <div
                    key={season.name}
                    className={`flex items-center justify-between p-2 rounded-lg ${season.bg}`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${season.color}`} />
                      <span className="text-sm font-medium">{season.name}</span>
                    </div>
                    <span className={`text-sm font-bold ${season.color}`}>
                      {season.total.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
