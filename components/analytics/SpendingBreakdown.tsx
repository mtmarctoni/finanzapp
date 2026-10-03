'use client';

import { createElement, useMemo, useState } from 'react';

import {
  ChartLoading,
  EmptyState,
  RankedBars,
  type RankedItem,
  Section,
  Segmented,
} from '@/components/analytics/kit';
import {
  CategoryTile,
  paymentIcon,
} from '@/components/quick-add/category-icon';
import {
  type CategoryDatum,
  type PlatformDatum,
  type TypeDatum,
} from '@/lib/analytics-charts';
import { formatCurrency } from '@/lib/utils';

type Dimension = 'category' | 'type' | 'platform';

const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: 'category', label: 'Categoría' },
  { key: 'type', label: 'Tipo' },
  { key: 'platform', label: 'Plataforma' },
];

interface Row {
  name: string;
  total: number;
  count: number;
}

function aggregate<T extends { total: number; count?: number }>(
  rows: T[],
  keyOf: (row: T) => string | null | undefined,
): Row[] {
  const map = new Map<string, Row>();
  for (const row of rows) {
    const name = keyOf(row) ?? 'Sin asignar';
    const entry = map.get(name) ?? { name, total: 0, count: 0 };
    entry.total += Math.abs(Number(row.total));
    entry.count += Number(row.count ?? 0);
    map.set(name, entry);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function PaymentTile({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-subtle"
    >
      {createElement(paymentIcon(name), { className: 'h-[18px] w-[18px]' })}
    </span>
  );
}

/**
 * Where the money went, ranked. One card with a dimension switch replaces the
 * old donut + two rainbow bar charts.
 */
export function SpendingBreakdown({
  categoryData,
  typeData,
  platformData,
  loading,
}: {
  categoryData: CategoryDatum[];
  typeData: TypeDatum[];
  platformData: PlatformDatum[];
  loading: boolean;
}) {
  const [dimension, setDimension] = useState<Dimension>('category');

  const rows = useMemo(() => {
    const isExpense = (a?: string | null) => a === 'Gasto' || !a;
    if (dimension === 'type')
      return aggregate(
        typeData.filter((d) => isExpense(d.action)),
        (d) => d.type,
      );
    if (dimension === 'platform')
      return aggregate(
        platformData.filter((d) => isExpense(d.action)),
        (d) => d.platform,
      );
    return aggregate(
      categoryData.filter((d) => isExpense(d.action)),
      (d) => d.category,
    );
  }, [dimension, categoryData, typeData, platformData]);

  const total = rows.reduce((sum, r) => sum + r.total, 0);
  const items: RankedItem[] = rows.map((r) => ({
    key: r.name,
    label: r.name,
    value: r.total,
    pct: total > 0 ? (r.total / total) * 100 : 0,
    count: r.count,
    icon:
      dimension === 'platform' ? (
        <PaymentTile name={r.name} />
      ) : (
        <CategoryTile name={r.name} />
      ),
  }));

  return (
    <Section
      title="Dónde va el dinero"
      description={
        total > 0 ? (
          <span className="num">{formatCurrency(total)} en gastos</span>
        ) : undefined
      }
    >
      <Segmented
        ariaLabel="Agrupar gastos por"
        value={dimension}
        onChange={setDimension}
        options={DIMENSIONS.map((d) => ({ value: d.key, label: d.label }))}
        className="mb-2"
      />
      {loading ? (
        <ChartLoading className="h-64" />
      ) : items.length > 0 ? (
        <RankedBars
          items={items}
          ariaLabel={`Gastos por ${DIMENSIONS.find((d) => d.key === dimension)?.label.toLowerCase()}`}
          shareLabel="del gasto"
          limit={6}
        />
      ) : (
        <EmptyState>No hay datos disponibles</EmptyState>
      )}
    </Section>
  );
}
