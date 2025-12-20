import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Line } from 'react-chartjs-2';
import { ChartData, ChartOptions } from 'chart.js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface NetTrendChartProps {
  data: ChartData<'line', number[], string>;
  options: ChartOptions<'line'>;
  loading: boolean;
}

export function NetTrendChart({ data, options, loading }: NetTrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tendencia Neta</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : (data?.labels?.length ?? 0) > 0 ? (
          <Line data={data} options={options} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            No hay datos disponibles
          </div>
        )}
      </CardContent>
    </Card>
  );
}
