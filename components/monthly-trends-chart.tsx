'use client'

import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { ChartData, ChartOptions } from 'chart.js'
import { formatCurrency } from "@/lib/utils"
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
)

interface MonthlyTrend {
  month: string // 'YYYY-MM-01' format
  income: number
  expenses: number
  investments: number
}

export default function MonthlyTrendsChart({ monthlyTrends }: { monthlyTrends: MonthlyTrend[] }) {
  const monthlyData = useMemo(() => {
    return [...monthlyTrends]
      .sort((left, right) => left.month.localeCompare(right.month))
      .map((item) => ({
        month: format(new Date(item.month), 'MMM yyyy', { locale: es }),
        income: item.income,
        expenses: item.expenses,
        investments: item.investments,
        netFlow: item.income - item.expenses - item.investments,
      }))
  }, [monthlyTrends])

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const rawValue = typeof context.raw === 'number' ? context.raw : Number(context.raw)
            return `${context.dataset.label}: ${formatCurrency(rawValue)}`
          },
        },
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
      },
      x: {
        grid: {
          display: false,
        },
      }
    }
  }

  const chartData: ChartData<'bar'> = {
    labels: monthlyData.map(d => d.month),
    datasets: [
      {
        label: 'Ingresos',
        data: monthlyData.map(d => d.income),
        backgroundColor: 'rgba(34, 197, 94, 0.35)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 1,
      },
      {
        label: 'Gastos',
        data: monthlyData.map(d => d.expenses),
        backgroundColor: 'rgba(239, 68, 68, 0.35)',
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 1,
      },
      {
        label: 'Inversiones',
        data: monthlyData.map(d => d.investments),
        backgroundColor: 'rgba(59, 130, 246, 0.35)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      },
      {
        label: 'Flujo neto',
        data: monthlyData.map(d => d.netFlow),
        type: 'line',
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.20)',
        pointRadius: 3,
        pointHoverRadius: 4,
        borderWidth: 2,
        tension: 0.3,
      },
    ],
  }

  return (
    <div className="h-80 w-full">
      <Bar 
        options={chartOptions} 
        data={chartData}
      />
    </div>
  )
}
