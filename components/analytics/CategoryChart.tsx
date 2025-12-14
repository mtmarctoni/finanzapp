import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Doughnut } from 'react-chartjs-2';
import React from "react";
import { ChartData, ChartOptions } from 'chart.js';

interface CategoryChartProps {
  data: ChartData<'doughnut', number[], string> & { total?: number };
  options: ChartOptions<'doughnut'>;
  loading: boolean;
}

export function CategoryChart({ data, options, loading }: CategoryChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribución por Categoría</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : (data?.labels?.length ?? 0) > 0 ? (
          <Doughnut data={data} options={options} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            No hay datos disponibles
          </div>
        )}
      </CardContent>
    </Card>
  );
}
