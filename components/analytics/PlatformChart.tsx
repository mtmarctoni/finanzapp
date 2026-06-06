import { type ChartData, type ChartOptions } from 'chart.js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

interface PlatformChartProps {
  data: ChartData<'bar', number[], string>;
  options: ChartOptions<'bar'>;
  loading: boolean;
}

export function PlatformChart({ data, options, loading }: PlatformChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gasto por Plataforma</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (data?.labels?.length ?? 0) > 0 ? (
          <Bar data={data} options={options} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No hay datos disponibles
          </div>
        )}
      </CardContent>
    </Card>
  );
}
