import { useState, useMemo } from "react";
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
import { CategoryTemporalDatum, TypeTemporalDatum, TipoQueDatum } from "@/lib/analytics-charts";
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

interface TrendExplorerProps {
  categoryTemporalData: CategoryTemporalDatum[];
  typeTemporalData: TypeTemporalDatum[];
  tipoQueData: TipoQueDatum[];
  types: string[];
  groupBy: "month" | "year";
  loading: boolean;
  getCategoryTrendData: (
    data: CategoryTemporalDatum[],
    category: string,
    groupBy: "month" | "year",
  ) => ChartData<'line', number[], string> & { counts?: number[]; trendSlope?: number };
  getTipoTrendData: (
    data: TypeTemporalDatum[],
    type: string,
    groupBy: "month" | "year",
  ) => ChartData<'line', number[], string> & { counts?: number[]; trendSlope?: number };
  getLineChartOptions: () => ChartOptions<'line'>;
}

export function TrendExplorer({
  categoryTemporalData,
  typeTemporalData,
  tipoQueData,
  types,
  groupBy,
  loading,
  getCategoryTrendData,
  getTipoTrendData,
  getLineChartOptions,
}: TrendExplorerProps) {
  const [selectedTipo, setSelectedTipo] = useState<string>("");
  const [selectedQue, setSelectedQue] = useState<string>("");

  // Build tipo → que mapping
  const tipoToQueMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const item of tipoQueData) {
      if (!map.has(item.type)) map.set(item.type, new Set());
      map.get(item.type)!.add(item.category);
    }
    return map;
  }, [tipoQueData]);

  // Available que options based on selected tipo
  const availableQue = selectedTipo && tipoToQueMap.has(selectedTipo)
    ? Array.from(tipoToQueMap.get(selectedTipo)!).sort()
    : [];

  const handleTipoChange = (tipo: string) => {
    setSelectedTipo(tipo);
    setSelectedQue("");
  };

  // Determine what chart data to show
  const isTipoOnly = selectedTipo && !selectedQue;
  const isQue = !!selectedQue;

  const chartData = isTipoOnly
    ? getTipoTrendData(typeTemporalData, selectedTipo, groupBy)
    : isQue
    ? getCategoryTrendData(categoryTemporalData, selectedQue, groupBy)
    : null;

  const chartOptions = getLineChartOptions();

  const trendSlope = chartData?.trendSlope || 0;
  const trendDirection =
    trendSlope > 0.5 ? "up" : trendSlope < -0.5 ? "down" : "flat";

  // Compute stats
  let totalSpend = 0;
  let dataPoints = 0;
  let avgPerPeriod = 0;

  if (isTipoOnly) {
    const tipoData = typeTemporalData.filter(
      (d) => d.type === selectedTipo && d.action === "Gasto",
    );
    totalSpend = tipoData.reduce((sum, d) => sum + Math.abs(Number(d.total)), 0);
    dataPoints = tipoData.length;
    avgPerPeriod = dataPoints > 0 ? totalSpend / dataPoints : 0;
  } else if (isQue) {
    const queData = categoryTemporalData.filter(
      (d) => d.category === selectedQue && d.action === "Gasto",
    );
    totalSpend = queData.reduce((sum, d) => sum + Math.abs(Number(d.total)), 0);
    dataPoints = queData.length;
    avgPerPeriod = dataPoints > 0 ? totalSpend / dataPoints : 0;
  }

  // Que breakdown for sub-table when tipo is selected
  const queBreakdown = isTipoOnly
    ? tipoQueData
        .filter((d) => d.type === selectedTipo)
        .map((d) => ({
          category: d.category,
          total: Math.abs(Number(d.total)),
          count: d.count || 0,
          action: d.action,
        }))
        .sort((a, b) => b.total - a.total)
    : [];

  const tipoTotal = queBreakdown.reduce((sum, d) => sum + d.total, 0);

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>Tendencias</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Evolución temporal de {selectedQue || selectedTipo || "todas las categorías"}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedTipo} onValueChange={handleTipoChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tipo (general)" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {types.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedQue} onValueChange={setSelectedQue} disabled={!selectedTipo}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={selectedTipo ? "Categoría (específica)" : "Selecciona tipo primero"} />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="">Todas (ver tipo agregado)</SelectItem>
              {availableQue.map((q) => (
                <SelectItem key={q} value={q}>
                  {q}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 h-80">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : chartData && (chartData?.labels?.length ?? 0) > 0 ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Selecciona un tipo o categoría para ver la tendencia
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
              <div className="text-xl font-bold">{dataPoints}</div>
            </div>
          </div>
        </div>

        {/* Sub-table: que breakdown when tipo is selected */}
        {isTipoOnly && queBreakdown.length > 0 && (
          <div className="mt-6 border-t pt-6">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              Desglose de categorías dentro de {selectedTipo}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {queBreakdown.map((item) => {
                const pct = tipoTotal > 0 ? (item.total / tipoTotal) * 100 : 0;
                const isExpense = item.action === "Gasto" || item.action === "Inversión";
                return (
                  <div key={item.category} className="p-3 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{item.category}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        isExpense ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      }`}>
                        {item.action}
                      </span>
                    </div>
                    <div className="text-lg font-bold">
                      {item.total.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 mt-2">
                      <div
                        className={`h-2 rounded-full ${isExpense ? "bg-red-400" : "bg-green-400"}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                      <span className="text-xs text-muted-foreground">{item.count} mov.</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
