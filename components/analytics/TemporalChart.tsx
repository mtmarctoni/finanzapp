import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar } from 'react-chartjs-2';
import { ChartData, ChartOptions } from 'chart.js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface TemporalChartProps {
  data: ChartData<'bar', number[], string>;
  options: ChartOptions<'bar'>;
  loading: boolean;
}

export function TemporalChart({ data, options, loading }: TemporalChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución Temporal</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : (data?.labels?.length ?? 0) > 0 ? (
          <Bar data={data} options={options} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            No hay datos disponibles para el rango seleccionado
          </div>
        )}
      </CardContent>
    </Card>
  );
}
