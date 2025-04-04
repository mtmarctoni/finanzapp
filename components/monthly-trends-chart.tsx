'use client'

import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { ChartData, ChartOptions } from 'chart.js'
import { formatCurrency } from "@/lib/utils"

interface MonthlyTrend {
  month: string
  income: number
  expenses: number
  investments: number
}

export default function MonthlyTrendsChart({ monthlyTrends }: { monthlyTrends: MonthlyTrend[] }) {
  ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

  // Prepare data for charts
  const monthlyData = monthlyTrends.map((month) => ({
    month: new Date(month.month).toLocaleString('es-ES', { month: 'short', year: 'numeric' }),
    income: month.income,
    expenses: month.expenses,
    investments: month.investments
  }))

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Tendencias Mensuales (Últimos 6 meses)',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (tickValue: string | number) => {
            const value = typeof tickValue === 'string' ? parseFloat(tickValue) : tickValue;
            return value !== undefined ? formatCurrency(value) : '';
          }
        }
      }
    }
  }

  const chartData: ChartData<'bar'> = {
    labels: monthlyData.map(d => d.month),
    datasets: [
      {
        label: 'Ingresos',
        data: monthlyData.map(d => d.income),
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      },
      {
        label: 'Gastos',
        data: monthlyData.map(d => d.expenses),
        backgroundColor: 'rgba(239, 68, 68, 0.5)',
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 1,
      },
      {
        label: 'Inversiones',
        data: monthlyData.map(d => d.investments),
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1,
      },
    ],
  }

  return (
    <div className="h-full w-full">
      <Bar 
        options={chartOptions} 
        data={chartData}
        height={300}
      />
    </div>
  )
}
