'use client';

import { type ChartData, type ChartOptions } from 'chart.js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend as ChartLegend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

import {
  themedBarOptions,
  useChartTheme,
  withAlpha,
} from '@/components/analytics/chart-theme';
import {
  ChartLoading,
  EmptyState,
  Legend,
  Section,
} from '@/components/analytics/kit';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  ChartLegend,
);

interface TemporalChartProps {
  data: ChartData<'bar', number[], string>;
  options: ChartOptions<'bar'>;
  loading: boolean;
}

/** Income vs. expenses per period: grey for money out, one hue for money in. */
export function TemporalChart({ data, options, loading }: TemporalChartProps) {
  const theme = useChartTheme();
  const labels = (data.labels ?? []) as string[];
  const colorFor: Record<string, string> = {
    Ingreso: theme.positive,
    Gasto: withAlpha(theme.subtle, 0.55),
  };
  const themed: ChartData<'bar', number[], string> = {
    labels,
    datasets: ['Ingreso', 'Gasto']
      .map((label) => data.datasets.find((d) => d.label === label))
      .filter((d) => d !== undefined)
      .map((d) => ({
        ...d,
        backgroundColor: colorFor[d.label ?? ''],
        hoverBackgroundColor: colorFor[d.label ?? ''],
        borderWidth: 0,
        borderDash: undefined,
      })),
  };

  return (
    <Section
      title="Ingresos y gastos"
      legend={
        <Legend
          items={[
            { label: 'Ingresos', color: theme.positive },
            { label: 'Gastos', color: withAlpha(theme.subtle, 0.55) },
          ]}
        />
      }
    >
      <div className="h-56 md:h-64">
        {loading ? (
          <ChartLoading />
        ) : labels.length > 0 ? (
          <Bar
            data={themed}
            options={themedBarOptions(theme, labels, options)}
          />
        ) : (
          <EmptyState className="h-full">
            No hay datos disponibles para el rango seleccionado
          </EmptyState>
        )}
      </div>
    </Section>
  );
}
