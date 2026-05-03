import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryStatDatum, CategoryPlatformDatum, CategoryDatum } from "@/lib/analytics-charts";
import { CreditCard, Wallet, TrendingUp, Hash, Calendar, Store } from "lucide-react";

interface CategoryIntelligenceProps {
  categoryStats: CategoryStatDatum[];
  categoryPlatformData: CategoryPlatformDatum[];
  categoryData: CategoryDatum[];
  temporalData: Array<{ period: string }>;
  loading: boolean;
}

export function CategoryIntelligence({
  categoryStats,
  categoryPlatformData,
  categoryData,
  temporalData,
  loading,
}: CategoryIntelligenceProps) {
  // Get categories that have stats
  const categories = Array.from(new Set(categoryStats.map((d) => d.category))).sort();
  const [selectedCategory, setSelectedCategory] = useState<string>(
    categories[0] || "",
  );

  const stats = categoryStats.filter((s) => s.category === selectedCategory);
  const expenseStats = stats.find((s) => s.action === "Gasto");

  // Top platform for this category
  const platformBreakdown = categoryPlatformData
    .filter((p) => p.category === selectedCategory)
    .sort((a, b) => Math.abs(Number(b.total)) - Math.abs(Number(a.total)));
  const topPlatform = platformBreakdown[0];

  // Total for this category
  const totalForCategory = categoryData
    .filter((c) => c.category === selectedCategory)
    .reduce((sum, c) => sum + Math.abs(Number(c.total)), 0);

  // Total of all expenses
  const totalExpenses = categoryData
    .filter((c) => c.action === "Gasto" || !c.action)
    .reduce((sum, c) => sum + Math.abs(Number(c.total)), 0);

  const pctOfTotal = totalExpenses > 0 ? (totalForCategory / totalExpenses) * 100 : 0;

  // Count distinct periods for frequency calculation
  const distinctPeriods = new Set(temporalData.map((t) => t.period)).size;
  const transactionsPerPeriod =
    expenseStats && distinctPeriods > 0
      ? expenseStats.count / distinctPeriods
      : 0;

  const statCards = [
    {
      label: "Transacción media",
      value: expenseStats
        ? expenseStats.avg.toLocaleString("es-ES", {
            style: "currency",
            currency: "EUR",
          })
        : "—",
      icon: CreditCard,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Mayor gasto",
      value: expenseStats
        ? expenseStats.max.toLocaleString("es-ES", {
            style: "currency",
            currency: "EUR",
          })
        : "—",
      icon: TrendingUp,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      label: "Menor gasto",
      value: expenseStats
        ? expenseStats.min.toLocaleString("es-ES", {
            style: "currency",
            currency: "EUR",
          })
        : "—",
      icon: Wallet,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Total transacciones",
      value: expenseStats ? `${expenseStats.count}` : "—",
      icon: Hash,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Frecuencia",
      value: expenseStats
        ? `${transactionsPerPeriod.toFixed(1)} / ${distinctPeriods > 12 ? "año" : "mes"}`
        : "—",
      icon: Calendar,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Plataforma principal",
      value: topPlatform?.platform || "—",
      icon: Store,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
  ];

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>Inteligencia de Categoría</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Métricas detalladas para una categoría concreta
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
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <div className="mb-4 p-3 rounded-lg bg-muted/50 flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Total en {selectedCategory}</div>
                <div className="text-2xl font-bold">
                  {totalForCategory.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Del gasto total</div>
                <div className="text-2xl font-bold">{pctOfTotal.toFixed(1)}%</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {statCards.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className={`p-3 rounded-lg ${stat.bg} border border-opacity-20`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`h-4 w-4 ${stat.color}`} />
                      <span className="text-xs text-muted-foreground">{stat.label}</span>
                    </div>
                    <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                  </div>
                );
              })}
            </div>

            {/* Platform breakdown mini */}
            {platformBreakdown.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Distribución por plataforma
                </h4>
                <div className="space-y-2">
                  {platformBreakdown.slice(0, 5).map((p) => {
                    const amount = Math.abs(Number(p.total));
                    const pct =
                      totalForCategory > 0 ? (amount / totalForCategory) * 100 : 0;
                    return (
                      <div key={p.platform} className="flex items-center gap-3 text-sm">
                        <span className="w-24 truncate text-muted-foreground">
                          {p.platform}
                        </span>
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="w-16 text-right font-medium">
                          {pct.toFixed(0)}%
                        </span>
                        <span className="w-20 text-right text-muted-foreground">
                          {amount.toLocaleString("es-ES", {
                            style: "currency",
                            currency: "EUR",
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
