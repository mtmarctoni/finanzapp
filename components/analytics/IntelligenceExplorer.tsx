import {
  CreditCard,
  Wallet,
  TrendingUp,
  Hash,
  Calendar,
  Store,
} from 'lucide-react';
import { useState, useMemo } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type CategoryStatDatum,
  type CategoryPlatformDatum,
  type CategoryDatum,
} from '@/lib/analytics-charts';

interface IntelligenceExplorerProps {
  categoryStats: CategoryStatDatum[];
  categoryPlatformData: CategoryPlatformDatum[];
  categoryData: CategoryDatum[];
  temporalData: { period: string }[];
  types: string[];
  loading: boolean;
}

export function IntelligenceExplorer({
  categoryStats,
  categoryPlatformData,
  categoryData,
  temporalData,
  types,
  loading,
}: IntelligenceExplorerProps) {
  const [selectedTipo, setSelectedTipo] = useState<string>('');
  const [selectedQue, setSelectedQue] = useState<string>('__all__');

  // Build tipo → que mapping
  const tipoToQueMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const item of categoryStats) {
      if (!map.has(item.type)) map.set(item.type, new Set());
      map.get(item.type)?.add(item.category);
    }
    return map;
  }, [categoryStats]);

  const availableQue =
    selectedTipo && tipoToQueMap.has(selectedTipo)
      ? Array.from(tipoToQueMap.get(selectedTipo) ?? []).sort()
      : [];

  const handleTipoChange = (tipo: string) => {
    setSelectedTipo(tipo);
    setSelectedQue('__all__');
  };

  // Determine what stats to show
  const isTipoOnly = selectedTipo && selectedQue === '__all__';
  const isQue = selectedTipo && selectedQue !== '__all__';

  // Stats computation
  let stats: CategoryStatDatum[] = [];
  let totalForSelection = 0;

  if (isTipoOnly) {
    stats = categoryStats.filter((s) => s.type === selectedTipo);
    totalForSelection = categoryData
      .filter((c) => c.type === selectedTipo)
      .reduce((sum, c) => sum + Math.abs(Number(c.total)), 0);
  } else if (isQue) {
    stats = categoryStats.filter((s) => s.category === selectedQue);
    totalForSelection = categoryData
      .filter((c) => c.category === selectedQue)
      .reduce((sum, c) => sum + Math.abs(Number(c.total)), 0);
  }

  const expenseStats = stats.find((s) => s.action === 'Gasto');

  // Total expenses for percentage
  const totalExpenses = categoryData
    .filter((c) => c.action === 'Gasto' || !c.action)
    .reduce((sum, c) => sum + Math.abs(Number(c.total)), 0);

  const pctOfTotal =
    totalExpenses > 0 ? (totalForSelection / totalExpenses) * 100 : 0;

  const distinctPeriods = new Set(temporalData.map((t) => t.period)).size;
  const transactionsPerPeriod =
    expenseStats && distinctPeriods > 0
      ? expenseStats.count / distinctPeriods
      : 0;

  // Platform breakdown
  let platformBreakdown: CategoryPlatformDatum[] = [];
  if (isTipoOnly) {
    // Aggregate platforms for all que within tipo
    const raw = categoryPlatformData.filter((p) => {
      // We need to know the tipo for each platform entry... but categoryPlatformData doesn't have tipo
      // So we use categoryData to map que → tipo
      const tipoForQue = categoryData.find(
        (c) => c.category === p.category,
      )?.type;
      return tipoForQue === selectedTipo;
    });
    const aggregated = new Map<string, number>();
    for (const item of raw) {
      const current = aggregated.get(item.platform) || 0;
      aggregated.set(item.platform, current + Math.abs(Number(item.total)));
    }
    platformBreakdown = Array.from(aggregated.entries())
      .map(([platform, total]) => ({ platform, category: '', total, count: 0 }))
      .sort((a, b) => b.total - a.total);
  } else if (isQue) {
    platformBreakdown = categoryPlatformData
      .filter((p) => p.category === selectedQue)
      .sort((a, b) => Math.abs(Number(b.total)) - Math.abs(Number(a.total)));
  }

  const topPlatform = platformBreakdown[0];

  const statCards = [
    {
      label: 'Transacción media',
      value: expenseStats
        ? expenseStats.avg.toLocaleString('es-ES', {
            style: 'currency',
            currency: 'EUR',
          })
        : '—',
      icon: CreditCard,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Mayor gasto',
      value: expenseStats
        ? expenseStats.max.toLocaleString('es-ES', {
            style: 'currency',
            currency: 'EUR',
          })
        : '—',
      icon: TrendingUp,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Menor gasto',
      value: expenseStats
        ? expenseStats.min.toLocaleString('es-ES', {
            style: 'currency',
            currency: 'EUR',
          })
        : '—',
      icon: Wallet,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Total transacciones',
      value: expenseStats ? `${expenseStats.count}` : '—',
      icon: Hash,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Frecuencia',
      value: expenseStats
        ? `${transactionsPerPeriod.toFixed(1)} / ${distinctPeriods > 12 ? 'año' : 'mes'}`
        : '—',
      icon: Calendar,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Plataforma principal',
      value: topPlatform?.platform || '—',
      icon: Store,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
  ];

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>Inteligencia Financiera</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Métricas detalladas por tipo o categoría
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
          <Select
            value={selectedQue}
            onValueChange={setSelectedQue}
            disabled={!selectedTipo}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue
                placeholder={
                  selectedTipo
                    ? 'Categoría (específica)'
                    : 'Selecciona tipo primero'
                }
              />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="__all__">Todas (ver tipo agregado)</SelectItem>
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
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : selectedTipo ? (
          <>
            <div className="mb-4 p-3 rounded-lg bg-muted/50 flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">
                  Total en {selectedQue || selectedTipo}
                </div>
                <div className="text-2xl font-bold">
                  {totalForSelection.toLocaleString('es-ES', {
                    style: 'currency',
                    currency: 'EUR',
                  })}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">
                  Del gasto total
                </div>
                <div className="text-2xl font-bold">
                  {pctOfTotal.toFixed(1)}%
                </div>
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
                      <span className="text-xs text-muted-foreground">
                        {stat.label}
                      </span>
                    </div>
                    <div className={`text-lg font-bold ${stat.color}`}>
                      {stat.value}
                    </div>
                  </div>
                );
              })}
            </div>

            {platformBreakdown.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Distribución por plataforma
                </h4>
                <div className="space-y-2">
                  {platformBreakdown.slice(0, 5).map((p) => {
                    const amount = Math.abs(Number(p.total));
                    const pct =
                      totalForSelection > 0
                        ? (amount / totalForSelection) * 100
                        : 0;
                    return (
                      <div
                        key={p.platform}
                        className="flex items-center gap-3 text-sm"
                      >
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
                          {amount.toLocaleString('es-ES', {
                            style: 'currency',
                            currency: 'EUR',
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            Selecciona un tipo para ver su inteligencia financiera
          </div>
        )}
      </CardContent>
    </Card>
  );
}
