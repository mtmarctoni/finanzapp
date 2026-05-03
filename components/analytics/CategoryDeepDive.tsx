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
import { CategoryPlatformDatum } from "@/lib/analytics-charts";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface CategoryDeepDiveProps {
  categoryData: Array<{ category: string; total: number; count?: number; action?: string | null }>;
  categoryPlatformData: CategoryPlatformDatum[];
  getChartData: (data: CategoryPlatformDatum[], category: string) => ChartData<'bar', number[], string> & { details?: Array<{ platform: string; total: number; count: number }> };
  getChartOptions: () => ChartOptions<'bar'>;
  loading: boolean;
}

export function CategoryDeepDive({
  categoryData,
  categoryPlatformData,
  getChartData,
  getChartOptions,
  loading,
}: CategoryDeepDiveProps) {
  // Get expense categories only, sorted by total spend
  const expenseCategories = categoryData
    .filter((item) => item.action === "Gasto" || !item.action)
    .sort((a, b) => Math.abs(Number(b.total)) - Math.abs(Number(a.total)))
    .map((item) => item.category);

  const uniqueCategories = Array.from(new Set(expenseCategories));
  const [selectedCategory, setSelectedCategory] = useState<string>(
    uniqueCategories[0] || "Comida"
  );

  const chartData = getChartData(categoryPlatformData, selectedCategory);
  const chartOptions = getChartOptions();

  const categoryTotal = categoryData
    .filter((item) => item.category === selectedCategory)
    .reduce((sum, item) => sum + Math.abs(Number(item.total)), 0);

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>Análisis por Categoría</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Total en <span className="font-semibold">{selectedCategory}</span>:{" "}
            {categoryTotal.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
          </p>
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Selecciona categoría" />
          </SelectTrigger>
          <SelectContent>
            {uniqueCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (chartData?.labels?.length ?? 0) > 0 ? (
              <Bar data={chartData} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No hay datos de plataforma para esta categoría
              </div>
            )}
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">
              Desglose por plataforma
            </h4>
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : chartData.details && chartData.details.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {chartData.details.map((item) => {
                  const pct = categoryTotal > 0 ? (item.total / categoryTotal) * 100 : 0;
                  return (
                    <div key={item.platform} className="flex items-center justify-between text-sm">
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium truncate">{item.platform}</span>
                          <span className="text-muted-foreground ml-2 shrink-0">
                            {item.total.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span className="text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                          <span className="text-xs text-muted-foreground">{item.count} mov.</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                No hay datos de plataforma para esta categoría
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
