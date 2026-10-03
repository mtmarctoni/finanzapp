'use client';

import { type ChartData, type ChartOptions } from 'chart.js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend as ChartLegend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

import {
  themedLineOptions,
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
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  ChartLegend,
);

interface NetTrendChartProps {
  /** First dataset is the headline series (one hue), the rest stay grey. */
  data: ChartData<'line', number[], string>;
  options: ChartOptions<'line'>;
  loading: boolean;
}

export function NetTrendChart({ data, options, loading }: NetTrendChartProps) {
  const theme = useChartTheme();
  const labels = (data.labels ?? []) as string[];
  const colors = data.datasets.map((_, i) =>
    i === 0 ? theme.foreground : theme.subtle,
  );
  const themed: ChartData<'line', number[], string> = {
    labels,
    datasets: data.datasets.map((d, i) => ({
      ...d,
      borderColor: colors[i],
      backgroundColor: i === 0 ? withAlpha(theme.foreground, 0.05) : colors[i],
      pointBackgroundColor: colors[i],
      fill: i === 0 ? 'origin' : false,
      borderWidth: i === 0 ? 2 : 1.5,
      borderDash: i === 0 ? undefined : [4, 4],
    })),
  };

  return (
    <Section
      title="Tendencia neta"
      legend={
        <Legend
          items={data.datasets.map((d, i) => ({
            label: d.label ?? '',
            color: colors[i],
            dashed: i > 0,
          }))}
        />
      }
    >
      <div className="h-56 md:h-64">
        {loading ? (
          <ChartLoading />
        ) : labels.length > 0 ? (
          <Line
            data={themed}
            options={themedLineOptions(theme, labels, options)}
          />
        ) : (
          <EmptyState className="h-full">No hay datos disponibles</EmptyState>
        )}
      </div>
    </Section>
  );
}
