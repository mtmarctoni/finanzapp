'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getSummaryStats } from "@/lib/server-data"
import { formatCurrency } from "@/lib/utils"
import { ArrowDownIcon, ArrowUpIcon, TrendingUpIcon, TrendingDownIcon, BarChart2Icon, PercentIcon } from "lucide-react"
import MonthlyTrendsChart from "@/components/monthly-trends-chart"
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useState, useEffect } from 'react'

interface MonthlyTrend {
  month: string
  income: number
  expenses: number
}

interface Category {
  category: string
  total: number
}

interface Investment {
  investment: string
  total: number
}

interface ExpenseBreakdown {
  total: number
  categories: Category[]
  averageMonthly: number
}

interface DashboardStats {
  totalIncome: number
  incomeCount: number
  totalExpense: number
  expenseCount: number
  totalInvestment: number
  investmentCount: number
  balance: number
  monthlyTrends: MonthlyTrend[]
  topCategories: Category[]
  investmentPerformance: Investment[]
  savingsRate: number
  expenseBreakdown: ExpenseBreakdown
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [selectedMonth, setSelectedMonth] = useState('')

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/summary?month=${selectedMonth}`)
        if (!response.ok) {
          throw new Error('Failed to fetch summary stats')
        }
        const data = await response.json()
        setStats(data)
      } catch (error) {
        console.error('Error fetching stats:', error)
      }
    }
    fetchStats()
  }, [selectedMonth])

  if (!stats) return <div>Loading...</div>

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Resumen Financiero</h2>
        <select
          className="rounded-md border px-3 py-2"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {Array.from({ length: 12 }, (_, i) => {
            const date = new Date()
            date.setMonth(date.getMonth() - i)
            const month = format(date, 'yyyy-MM-01')
            const monthName = format(date, 'MMMM yyyy', { locale: es })
            return (
              <option key={month} value={month}>{monthName}</option>
            )
          })}
        </select>
      </div>

      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ingresos</CardTitle>
            <ArrowUpIcon className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalIncome)}</div>
            <p className="text-xs text-muted-foreground">{stats.incomeCount} transacciones</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gastos</CardTitle>
            <ArrowDownIcon className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalExpense)}</div>
            <p className="text-xs text-muted-foreground">{stats.expenseCount} transacciones</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.balance)}</div>
            <p className="text-xs text-muted-foreground">{stats.savingsRate.toFixed(1)}% ahorro</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Detailed Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Monthly Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Tendencias Mensuales</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyTrendsChart monthlyTrends={stats.monthlyTrends} />
          </CardContent>
        </Card>

        {/* Expense Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Desglose de Gastos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <BarChart2Icon className="h-4 w-4 text-gray-500" />
                  <span>Total Gastos Anuales</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatCurrency(stats.expenseBreakdown.total)}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatCurrency(stats.expenseBreakdown.averageMonthly)} mensuales
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {stats.expenseBreakdown.categories.map((category: Category) => (
                  <div key={category.category} className="flex justify-between items-center">
                    <span className="text-sm">{category.category}</span>
                    <div className="text-right">
                      <span className="font-medium">{formatCurrency(category.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Investment Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Rendimiento de Inversiones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <TrendingUpIcon className="h-4 w-4 text-green-500" />
                  <span>Total Inversiones</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatCurrency(stats.totalInvestment)}</div>
                  <div className="text-sm text-muted-foreground">
                    {stats.investmentCount} inversiones
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {stats.investmentPerformance.map((investment: Investment) => (
                  <div key={investment.investment} className="flex justify-between items-center">
                    <span className="text-sm">{investment.investment}</span>
                    <div className="text-right">
                      <span className="font-medium">{formatCurrency(investment.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Savings Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Tasa de Ahorro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <PercentIcon className="h-4 w-4 text-green-500" />
                  <span>Ahorro Mensual</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{stats.savingsRate.toFixed(1)}%</div>
                  <div className="text-sm text-muted-foreground">
                    {stats.savingsRate > 20 ? 'Excelente' : stats.savingsRate > 10 ? 'Bueno' : 'Necesita mejorar'}
                  </div>
                </div>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-green-500 h-2.5 rounded-full transition-all duration-300"
                  style={stats.savingsRate > 0 ? { width: `${stats.savingsRate}%` } : { width: '0%' }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
