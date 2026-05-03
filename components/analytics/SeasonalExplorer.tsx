import { useState, useMemo } from "react";
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
import { CategoryTemporalDatum } from "@/lib/analytics-charts";
import { Sun, Snowflake, Leaf, Flower2 } from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface SeasonalExplorerProps {
  categoryTemporalData: CategoryTemporalDatum[];
  types: string[];
  getChartData: (data: Array<{ monthName: string; total: number }>) => ChartData<'bar', number[], string>;
  getChartOptions: () => ChartOptions<'bar'>;
  loading: boolean;
}

export function SeasonalExplorer({
  categoryTemporalData,
  types,
  getChartData,
  getChartOptions,
  loading,
}: SeasonalExplorerProps) {
  const [selectedTipo, setSelectedTipo] = useState<string>("");
  const [selectedQue, setSelectedQue] = useState<string>("");

  // Build tipo → que mapping
  const tipoToQueMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const item of categoryTemporalData) {
      if (!map.has(item.type)) map.set(item.type, new Set());
      map.get(item.type)!.add(item.category);
    }
    return map;
  }, [categoryTemporalData]);

  const availableQue = selectedTipo && tipoToQueMap.has(selectedTipo)
    ? Array.from(tipoToQueMap.get(selectedTipo)!).sort()
    : [];

  const handleTipoChange = (tipo: string) => {
    setSelectedTipo(tipo);
    setSelectedQue("");
  };

  // Compute seasonal data
  const seasonalData = useMemo(() => {
    const monthNames = [
      "Ene", "Feb", "Mar", "Abr", "May", "Jun",
      "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
    ];

    const filtered = categoryTemporalData.filter((item) => {
      if (selectedQue) return item.category === selectedQue && item.action === "Gasto";
      if (selectedTipo) return item.type === selectedTipo && item.action === "Gasto";
      return false;
    });

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
      total: data.yearCount > 0 ? data.total / data.yearCount : 0,
      count: data.yearCount > 0 ? Math.round(data.count / data.yearCount) : 0,
    }));
  }, [categoryTemporalData, selectedTipo, selectedQue]);

  const chartData = getChartData(seasonalData);
  const chartOptions = getChartOptions();

  const sorted = [...seasonalData].sort((a, b) => b.total - a.total);
  const peakMonth = sorted[0];
  const lowMonth = sorted[sorted.length - 1];

  const seasons = [
    { name: "Invierno", months: [11, 0, 1], icon: Snowflake, color: "text-blue-500", bg: "bg-blue-50" },
    { name: "Primavera", months: [2, 3, 4], icon: Flower2, color: "text-green-500", bg: "bg-green-50" },
    { name: "Verano", months: [5, 6, 7], icon: Sun, color: "text-amber-500", bg: "bg-amber-50" },
    { name: "Otoño", months: [8, 9, 10], icon: Leaf, color: "text-orange-500", bg: "bg-orange-50" },
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
            ¿En qué meses gastas más?
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
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : selectedTipo ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-64">
              {(chartData?.labels?.length ?? 0) > 0 ? (
                <Bar data={chartData} options={chartOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No hay datos estacionales
                </div>
              )}
            </div>
            <div className="space-y-4">
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
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Por estación
                </h4>
                {seasonTotals.map((season) => {
                  const Icon = season.icon;
                  return (
                    <div key={season.name} className={`flex items-center justify-between p-2 rounded-lg ${season.bg}`}>
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
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Selecciona un tipo para ver sus patrones estacionales
          </div>
        )}
      </CardContent>
    </Card>
  );
}
