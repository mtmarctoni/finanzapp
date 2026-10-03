'use client';

import { type ChartData } from 'chart.js';
import { useState } from 'react';

import {
  ChartLoading,
  EmptyState,
  PillSelect,
  RankedBars,
  Section,
} from '@/components/analytics/kit';
import { paymentIcon } from '@/components/quick-add/category-icon';
import { type CategoryPlatformDatum } from '@/lib/analytics-charts';
import { formatCurrency } from '@/lib/utils';

interface CategoryDeepDiveProps {
  categoryData: {
    category: string;
    total: number;
    count?: number;
    action?: string | null;
  }[];
  categoryPlatformData: CategoryPlatformDatum[];
  getChartData: (
    data: CategoryPlatformDatum[],
    category: string,
  ) => ChartData<'bar', number[], string> & {
    details?: { platform: string; total: number; count: number }[];
  };
  loading: boolean;
}

/** One expense category, broken down by how it was paid. */
export function CategoryDeepDive({
  categoryData,
  categoryPlatformData,
  getChartData,
  loading,
}: CategoryDeepDiveProps) {
  // Get expense categories only, sorted by total spend
  const expenseCategories = categoryData
    .filter((item) => item.action === 'Gasto' || !item.action)
    .sort((a, b) => Math.abs(Number(b.total)) - Math.abs(Number(a.total)))
    .map((item) => item.category);

  const uniqueCategories = Array.from(new Set(expenseCategories));
  const [picked, setPicked] = useState<string>('');
  const selectedCategory = picked || uniqueCategories[0] || '';

  const details = getChartData(categoryPlatformData, selectedCategory).details;

  const categoryTotal = categoryData
    .filter((item) => item.category === selectedCategory)
    .reduce((sum, item) => sum + Math.abs(Number(item.total)), 0);

  return (
    <Section
      title="Por categoría y plataforma"
      description={
        selectedCategory ? (
          <span className="num">
            {formatCurrency(categoryTotal)} en {selectedCategory}
          </span>
        ) : undefined
      }
      action={
        uniqueCategories.length > 0 && (
          <PillSelect
            ariaLabel="Categoría"
            value={selectedCategory}
            onValueChange={setPicked}
            placeholder="Selecciona categoría"
            options={uniqueCategories}
          />
        )
      }
    >
      {loading ? (
        <ChartLoading className="h-48" />
      ) : details && details.length > 0 ? (
        <RankedBars
          ariaLabel={`Plataformas en ${selectedCategory}`}
          shareLabel="de la categoría"
          items={details.map((item) => {
            const Icon = paymentIcon(item.platform);
            return {
              key: item.platform,
              label: item.platform,
              value: item.total,
              pct: categoryTotal > 0 ? (item.total / categoryTotal) * 100 : 0,
              count: item.count,
              icon: (
                <span
                  aria-hidden
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-subtle"
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
              ),
            };
          })}
          limit={5}
        />
      ) : (
        <EmptyState>No hay datos de plataforma para esta categoría</EmptyState>
      )}
    </Section>
  );
}
