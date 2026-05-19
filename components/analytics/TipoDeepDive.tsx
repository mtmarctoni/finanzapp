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
import { TipoQueDatum } from "@/lib/analytics-charts";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface TipoDeepDiveProps {
  tipoQueData: TipoQueDatum[];
  getChartData: (data: TipoQueDatum[], type: string) => ChartData<'bar', number[], string> & { details?: Array<{ category: string; total: number; count: number; action: string }> };
  getChartOptions: () => ChartOptions<'bar'>;
  loading: boolean;
}

export function TipoDeepDive({
  tipoQueData,
  getChartData,
  getChartOptions,
  loading,
}: TipoDeepDiveProps) {
  // Get unique types that have que breakdowns
  const types = Array.from(new Set(tipoQueData.map((d) => d.type))).sort();
  const [selectedType, setSelectedType] = useState<string>(types[0] || "");

  const chartData = getChartData(tipoQueData, selectedType);
  const chartOptions = getChartOptions();

  const typeTotal = tipoQueData
    .filter((item) => item.type === selectedType)
    .reduce((sum, item) => sum + Math.abs(Number(item.total)), 0);

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>Explorador por Tipo</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Dentro de <span className="font-semibold">{selectedType}</span> has movido{" "}
            {typeTotal.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
          </p>
        </div>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Selecciona tipo" />
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
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
                No hay datos para este tipo
              </div>
            )}
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">
              Desglose de categorías
            </h4>
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : chartData.details && chartData.details.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {chartData.details.map((item) => {
                  const pct = typeTotal > 0 ? (item.total / typeTotal) * 100 : 0;
                  const isExpense = item.action === "Gasto" || item.action === "Inversión";
                  return (
                    <div key={item.category} className="flex items-center justify-between text-sm">
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{item.category}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                              isExpense
                                ? "bg-red-100 text-red-700"
                                : "bg-green-100 text-green-700"
                            }`}>
                              {item.action}
                            </span>
                          </div>
                          <span className="text-muted-foreground ml-2 shrink-0">
                            {item.total.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${isExpense ? "bg-red-400" : "bg-green-400"}`}
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
                No hay datos de categorías para este tipo
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
