'use client';

import { type ChartData } from 'chart.js';
import { useState } from 'react';

import {
  ActionBadge,
  ChartLoading,
  EmptyState,
  PillSelect,
  RankedBars,
  Section,
} from '@/components/analytics/kit';
import { CategoryTile } from '@/components/quick-add/category-icon';
import { type TipoQueDatum } from '@/lib/analytics-charts';
import { formatCurrency } from '@/lib/utils';

interface TipoExplorerProps {
  tipoQueData: TipoQueDatum[];
  types: string[];
  getChartData: (
    data: TipoQueDatum[],
    type: string,
  ) => ChartData<'bar', number[], string> & {
    details?: {
      category: string;
      total: number;
      count: number;
      action: string;
    }[];
    total?: number;
  };
  loading: boolean;
  selectedTipo?: string;
  onTipoChange?: (tipo: string) => void;
}

/** Categories (que) inside one tipo, ranked by amount moved. */
export function TipoExplorer({
  tipoQueData,
  types,
  getChartData,
  loading,
  selectedTipo: selectedTipoProp,
  onTipoChange,
}: TipoExplorerProps) {
  const [internalTipo, setInternalTipo] = useState<string>('');

  const isControlled =
    selectedTipoProp !== undefined && onTipoChange !== undefined;
  const selectedTipo = isControlled
    ? selectedTipoProp
    : internalTipo || types[0] || '';

  const handleTipoChange = (tipo: string) => {
    if (isControlled) onTipoChange(tipo);
    else setInternalTipo(tipo);
  };

  const chartData = getChartData(tipoQueData, selectedTipo);
  const tipoTotal = chartData.total ?? 0;
  const details = chartData.details ?? [];

  return (
    <Section
      title="Explorador por tipo"
      description={
        <span className="num">
          {formatCurrency(tipoTotal)} movidos en {selectedTipo || '—'}
        </span>
      }
      action={
        // The tipo page already has a tipo rail; only offer a picker here
        // when the explorer drives itself.
        !isControlled && (
          <PillSelect
            ariaLabel="Tipo"
            value={selectedTipo}
            onValueChange={handleTipoChange}
            placeholder="Selecciona tipo"
            options={types}
          />
        )
      }
    >
      {loading ? (
        <ChartLoading className="h-48" />
      ) : details.length > 0 ? (
        <RankedBars
          ariaLabel={`Categorías en ${selectedTipo}`}
          shareLabel="del tipo"
          limit={6}
          items={details.map((item) => ({
            key: `${item.category}-${item.action}`,
            label: item.category,
            value: item.total,
            pct: tipoTotal > 0 ? (item.total / tipoTotal) * 100 : 0,
            count: item.count,
            icon: <CategoryTile name={item.category} />,
            badge: <ActionBadge action={item.action} />,
            tone:
              item.action === 'Ingreso'
                ? 'positive'
                : item.action === 'Inversión'
                  ? 'invest'
                  : 'neutral',
          }))}
        />
      ) : (
        <EmptyState>No hay datos para este tipo</EmptyState>
      )}
    </Section>
  );
}
