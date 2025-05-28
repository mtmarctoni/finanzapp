// app/analytics/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bar, Doughnut } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement 
} from 'chart.js';
import { SearchFilter } from "@/components/search-filter";

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

interface AnalyticsData {
  temporalData: Array<{
    month: string;
    action: string;
    total: number;
  }>;
  categoryData: Array<{
    category: string;
    action: string;
    total: number;
  }>;
}

interface Filters {
  search: string;
  accion: string;
  from?: Date;
  to?: Date;
}

export default function AnalyticsPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<AnalyticsData>({
    temporalData: [],
    categoryData: [],
  });
  const [loading, setLoading] = useState(true);
  
  // Initialize filters from URL params
  const initialFilters = () => {
    const search = searchParams.get('search') || '';
    const accion = searchParams.get('accion') || 'todos';
    const from = searchParams.get('from') ? new Date(searchParams.get('from') as string) : undefined;
    const to = searchParams.get('to') ? new Date(searchParams.get('to') as string) : undefined;
    
    return { search, accion, from, to };
  };
  
  const [filters, setFilters] = useState<Filters>(initialFilters());

  useEffect(() => {
    setFilters(initialFilters());
  }, [searchParams]);

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filters.search) params.set('search', filters.search);
      if (filters.accion && filters.accion !== 'todos') params.set('action', filters.accion);
      if (filters.from) params.set('from', filters.from.toISOString().split('T')[0]);
      if (filters.to) params.set('to', filters.to.toISOString().split('T')[0]);
      
      const response = await fetch(`/api/analytics?${params.toString()}`);
      if (!response.ok) throw new Error('Error fetching analytics data');
      
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Prepare data for temporal chart
  const getTemporalChartData = () => {
    const months = Array.from(new Set(data.temporalData.map(item => item.month))).sort();
    const actions = Array.from(new Set(data.temporalData.map(item => item.action)));
    
    const datasets = actions.map(action => {
      const color = action === 'Ingreso' 
        ? 'rgba(75, 192, 192, 0.6)' 
        : action === 'Gasto' 
          ? 'rgba(255, 99, 132, 0.6)' 
          : 'rgba(54, 162, 235, 0.6)';

      return {
        label: action,
        data: months.map(month => {
          const item = data.temporalData.find(d => d.month === month && d.action === action);
          return item ? Math.abs(item.total) : 0;
        }),
        backgroundColor: color,
        borderColor: color.replace('0.6', '1'),
        borderWidth: 1,
      };
    });

    return {
      labels: months.map(month => format(new Date(month), 'MMM yyyy', { locale: es })),
      datasets,
    };
  };

  // Prepare data for category chart
  const getCategoryChartData = () => {
    const sortedData = [...data.categoryData].sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
    const colors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
      '#FF9F40', '#8AC24A', '#FF5252', '#607D8B', '#9C27B0'
    ];
    
    return {
      labels: sortedData.map(item => item.category),
      datasets: [{
        data: sortedData.map(item => Math.abs(item.total)),
        backgroundColor: sortedData.map((_, index) => colors[index % colors.length]),
        borderWidth: 1,
      }],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.raw as number;
            return `${label}: ${value.toFixed(2)} €`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => `${value} €`
        }
      }
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Analíticas Financieras</h1>
      
      {/* Search and Filters */}
      <div className="mb-6">
        <SearchFilter 
          defaultValues={{
            search: filters.search,
            accion: filters.accion,
            fromDate: filters.from,
            toDate: filters.to
          }}
          onSearch={(newFilters) => {
            setFilters({
              search: newFilters.search,
              accion: newFilters.accion,
              from: newFilters.from,
              to: newFilters.to
            });
          }}
          showActionFilter={true}
          className="bg-white p-4 rounded-lg shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Temporal Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Evolución Temporal</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : data.temporalData.length > 0 ? (
              <Bar
                data={getTemporalChartData()}
                options={chartOptions}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No hay datos disponibles para el rango seleccionado
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Category Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución por Categoría</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : data.categoryData.length > 0 ? (
              <Doughnut
                data={getCategoryChartData()}
                options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    legend: {
                      position: 'right' as const,
                    },
                    tooltip: {
                      callbacks: {
                        label: (context: any) => {
                          const label = context.label || '';
                          const value = context.raw as number;
                          const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                          const percentage = Math.round((value / total) * 100);
                          return `${label}: ${value.toFixed(2)} € (${percentage}%)`;
                        }
                      }
                    }
                  }
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No hay datos disponibles
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}