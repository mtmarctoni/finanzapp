import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Line } from 'react-chartjs-2';
import { ChartData, ChartOptions } from 'chart.js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { CategoryTemporalDatum } from "@/lib/analytics-charts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface CategoryTrendTrackerProps {
  categoryTemporalData: CategoryTemporalDatum[];
  getChartData: (
    data: CategoryTemporalDatum[],
    category: string,
    groupBy: "month" | "year",
  ) => ChartData<'line', number[], string> & { counts?: number[]; trendSlope?: number };
  getChartOptions: () => ChartOptions<'line'>;
  groupBy: "month" | "year";
  loading: boolean;
}

export function CategoryTrendTracker({
  categoryTemporalData,
  getChartData,
  getChartOptions,
  groupBy,
  loading,
}: CategoryTrendTrackerProps) {
  // Get unique categories that have temporal data
  const categories = Array.from(
    new Set(categoryTemporalData.map((d) => d.category)),
  ).sort();

  const [selectedCategory, setSelectedCategory] = useState<string>(
    categories.find((c) =>
      ["Fiesta", "Gym", "Comida", "Viajes/ Transporte"].includes(c),
    ) || categories[0] || "",
  );

  const chartData = getChartData(categoryTemporalData, selectedCategory, groupBy);
  const chartOptions = getChartOptions();

  // Determine trend direction
  const trendSlope = chartData.trendSlope || 0;
  const trendDirection =
    trendSlope > 0.5 ? "up" : trendSlope < -0.5 ? "down" : "flat";

  // Compute total spend and avg per period for this category
  const categoryData = categoryTemporalData.filter(
    (d) => d.category === selectedCategory && d.action === "Gasto",
  );
  const totalSpend = categoryData.reduce(
    (sum, d) => sum + Math.abs(Number(d.total)),
    0,
  );
  const avgPerPeriod =
    categoryData.length > 0 ? totalSpend / categoryData.length : 0;

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>Tendencia por Categoría</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Evolución de <span className="font-semibold">{selectedCategory}</span> a lo largo del tiempo
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 h-80">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (chartData?.labels?.length ?? 0) > 0 ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No hay datos temporales para esta categoría
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground mb-1">Tendencia</div>
              <div className="flex items-center gap-2">
                {trendDirection === "up" ? (
                  <>
                    <TrendingUp className="h-5 w-5 text-red-500" />
                    <span className="text-lg font-bold text-red-500">Subiendo</span>
                  </>
                ) : trendDirection === "down" ? (
                  <>
                    <TrendingDown className="h-5 w-5 text-green-500" />
                    <span className="text-lg font-bold text-green-500">Bajando</span>
                  </>
                ) : (
                  <>
                    <Minus className="h-5 w-5 text-muted-foreground" />
                    <span className="text-lg font-bold text-muted-foreground">Estable</span>
                  </>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {trendSlope > 0 ? "+" : ""}
                {trendSlope.toFixed(0)} €/{groupBy === "year" ? "año" : "mes"} de media
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground mb-1">Total gastado</div>
              <div className="text-xl font-bold">
                {totalSpend.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground mb-1">
                Media por {groupBy === "year" ? "año" : "mes"}
              </div>
              <div className="text-xl font-bold">
                {avgPerPeriod.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground mb-1">Periodos con datos</div>
              <div className="text-xl font-bold">{categoryData.length}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
