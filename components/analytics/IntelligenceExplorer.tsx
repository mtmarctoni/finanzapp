import {
  CreditCard,
  Wallet,
  TrendingUp,
  Hash,
  Calendar,
  Store,
} from 'lucide-react';
import { useState, useMemo } from 'react';

import {
  Amount,
  ChartLoading,
  EmptyState,
  fmtPct,
  PillSelect,
  RankedBars,
  Section,
} from '@/components/analytics/kit';
import { paymentIcon } from '@/components/quick-add/category-icon';
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
  const [pickedTipo, setSelectedTipo] = useState<string>('');
  const selectedTipo = pickedTipo || types[0] || '';
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

  // categoryData does not always carry the tipo; fall back to the stats so
  // the headline total is never a misleading 0.
  if (totalForSelection === 0) {
    totalForSelection = stats
      .filter((s) => s.action === 'Gasto')
      .reduce((sum, s) => sum + Math.abs(Number(s.avg) * Number(s.count)), 0);
  }

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
      const current = aggregated.get(item.platform) ?? 0;
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

  const topPlatform = platformBreakdown.at(0);

  const statCards = [
    {
      label: 'Transacción media',
      value: expenseStats ? <Amount amount={Number(expenseStats.avg)} /> : '—',
      icon: CreditCard,
    },
    {
      label: 'Mayor gasto',
      value: expenseStats ? <Amount amount={Number(expenseStats.max)} /> : '—',
      icon: TrendingUp,
    },
    {
      label: 'Menor gasto',
      value: expenseStats ? <Amount amount={Number(expenseStats.min)} /> : '—',
      icon: Wallet,
    },
    {
      label: 'Total transacciones',
      value: expenseStats ? `${expenseStats.count}` : '—',
      icon: Hash,
    },
    {
      label: 'Frecuencia',
      value: expenseStats
        ? `${transactionsPerPeriod.toLocaleString('es-ES', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} / ${distinctPeriods > 12 ? 'año' : 'mes'}`
        : '—',
      icon: Calendar,
    },
    {
      label: 'Plataforma principal',
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty platform string from DB must also render as em dash
      value: topPlatform?.platform || '—',
      icon: Store,
    },
  ];

  const selectionLabel = selectedQue !== '__all__' ? selectedQue : selectedTipo;

  return (
    <Section
      title="Inteligencia financiera"
      description="Métricas detalladas por tipo o categoría"
      action={
        <>
          <PillSelect
            ariaLabel="Tipo"
            value={selectedTipo}
            onValueChange={handleTipoChange}
            placeholder="Tipo (general)"
            options={types}
          />
          <PillSelect
            ariaLabel="Categoría"
            value={selectedQue}
            onValueChange={setSelectedQue}
            disabled={!selectedTipo}
            placeholder={
              selectedTipo
                ? 'Categoría (específica)'
                : 'Selecciona tipo primero'
            }
            allOption={{ value: '__all__', label: 'Todas las categorías' }}
            options={availableQue}
          />
        </>
      }
    >
      {loading ? (
        <ChartLoading className="h-48" />
      ) : selectedTipo ? (
        <>
          <div className="flex items-end justify-between gap-4 border-b border-hairline pb-4">
            <div className="min-w-0">
              <p className="truncate text-[13px] text-subtle">
                Total en {selectionLabel}
              </p>
              <p className="num mt-0.5 text-[22px] font-semibold tracking-[-0.03em]">
                <Amount amount={totalForSelection} />
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[13px] text-subtle">Del gasto total</p>
              <p className="num mt-0.5 text-[22px] font-semibold tracking-[-0.03em]">
                {fmtPct(pctOfTotal)}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 py-4 md:grid-cols-3">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="min-w-0">
                  <dt className="flex items-center gap-1.5 text-[12px] text-faint">
                    <Icon className="h-3.5 w-3.5" />
                    {stat.label}
                  </dt>
                  <dd className="num mt-0.5 truncate text-[17px] font-semibold tracking-[-0.02em]">
                    {stat.value}
                  </dd>
                </div>
              );
            })}
          </dl>

          {platformBreakdown.length > 0 && (
            <div className="border-t border-hairline pt-4">
              <h3 className="mb-1 text-[13px] font-semibold text-subtle">
                Por plataforma
              </h3>
              <RankedBars
                ariaLabel={`Plataformas en ${selectionLabel}`}
                shareLabel="del total"
                items={platformBreakdown.slice(0, 5).map((p) => {
                  const amount = Math.abs(Number(p.total));
                  const PIcon = paymentIcon(p.platform);
                  return {
                    key: p.platform,
                    label: p.platform,
                    value: amount,
                    pct:
                      totalForSelection > 0
                        ? (amount / totalForSelection) * 100
                        : 0,
                    icon: (
                      <span
                        aria-hidden
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-subtle"
                      >
                        <PIcon className="h-[18px] w-[18px]" />
                      </span>
                    ),
                  };
                })}
              />
            </div>
          )}
        </>
      ) : (
        <EmptyState>
          Selecciona un tipo para ver su inteligencia financiera
        </EmptyState>
      )}
    </Section>
  );
}
