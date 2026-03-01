'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { ArrowDownIcon, ArrowUpIcon, TrendingUpIcon, BarChart2Icon, PercentIcon, WalletIcon, ChevronDown } from "lucide-react"
import MonthlyTrendsChart from "@/components/monthly-trends-chart"
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from "next/link"
import { useState, useEffect, useCallback, useMemo } from 'react'

interface MonthlyTrend {
  month: string
  income: number
  expenses: number
  investments: number
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
  hasMore?: boolean
}

interface IncomeBreakdown {
  total: number
  categories: Category[]
  averageMonthly: number
  hasMore?: boolean
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
  incomeBreakdown: IncomeBreakdown
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date()
    return format(today, 'yyyy-MM-01')
  })
  const [showAll, setShowAll] = useState({
    income: false,
    expenses: false,
    investments: false
  })
  const [isLoading, setIsLoading] = useState(false)

  const monthOptions = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
      return {
        value: format(date, 'yyyy-MM-01'),
        label: format(date, 'MMMM yyyy', { locale: es }),
      }
    })
  }, [])

  const fetchStats = useCallback(async (showAllType?: 'income' | 'expenses' | 'investments') => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        month: selectedMonth,
        ...(showAllType ? { showAll: 'true' } : {})
      })
      
      const response = await fetch(`/api/summary?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch summary stats')
      }
      const data = await response.json()
      
      setStats(data)
      
      // If showAllType is provided, update the showAll state
      if (showAllType) {
        setShowAll(prev => ({
          ...prev,
          [showAllType]: true
        }))
      } else {
        // Reset all showAll states when month changes
        setShowAll({
          income: false,
          expenses: false,
          investments: false
        })
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedMonth])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const renderLoading = () => (
    <div className="flex items-center justify-center min-h-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )

  if (!stats) return renderLoading()

  const finalBalance = stats.totalIncome - stats.totalExpense - stats.totalInvestment

  const getPercentage = (value: number, total: number) => {
    if (total <= 0) return 0
    return Math.min(100, (value / total) * 100)
  }
  
  const handleShowAll = (type: 'income' | 'expenses' | 'investments') => {
    fetchStats(type)
  }

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Resumen Financiero</h2>
        <select
          className="rounded-md border bg-background px-3 py-2"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {monthOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {/* Navigation Links */}
      <div className="flex space-x-4">
        <Link href="/recurring" className="text-primary hover:underline">
          <span className="flex items-center space-x-2">
            <ArrowUpIcon className="h-4 w-4" />
            <span>Registros Recurrentes</span>
          </span>
        </Link>
      </div>

      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance Final</CardTitle>
            <PercentIcon className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(finalBalance)}</div>
            <p className="text-xs text-muted-foreground">Flujo mensual</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Detailed Stats */}
      <div className="flex flex-col gap-4 md:flex-col-2">
        {/* Monthly Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Tendencias Mensuales</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyTrendsChart monthlyTrends={stats.monthlyTrends} />
          </CardContent>
        </Card>

        {/* Income Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Desglose de Ingresos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <WalletIcon className="h-4 w-4 text-green-500" />
                  <span>Total Ingresos Anuales</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatCurrency(stats.incomeBreakdown?.total || 0)}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatCurrency(stats.incomeBreakdown?.averageMonthly || 0)} mensuales
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {stats.incomeBreakdown?.categories?.map((category: Category) => (
                  <div key={category.category} className="space-y-1">
                    <div className="flex justify-between items-center gap-4">
                      <span className="text-sm">{category.category}</span>
                      <div className="text-right">
                        <span className="font-medium">{formatCurrency(category.total)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {getPercentage(category.total, stats.incomeBreakdown?.total || 0).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-primary"
                        style={{ width: `${getPercentage(category.total, stats.incomeBreakdown?.total || 0)}%` }}
                      />
                    </div>
                  </div>
                )) || <p className="text-sm text-muted-foreground">No hay datos de ingresos disponibles</p>}
                
                {stats.incomeBreakdown?.hasMore && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-2 text-sm text-muted-foreground"
                    onClick={() => handleShowAll('income')}
                    disabled={isLoading}
                  >
                    {isLoading && showAll.income ? (
                      <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <ChevronDown className="h-4 w-4 mr-1" />
                    )}
                    Mostrar todos
                  </Button>
                )}
              </div>
            </div>
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
                  <BarChart2Icon className="h-4 w-4 text-red-500" />
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
                  <div key={category.category} className="space-y-1">
                    <div className="flex justify-between items-center gap-4">
                      <span className="text-sm">{category.category}</span>
                      <div className="text-right">
                        <span className="font-medium">{formatCurrency(category.total)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {getPercentage(category.total, stats.expenseBreakdown.total).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-destructive"
                        style={{ width: `${getPercentage(category.total, stats.expenseBreakdown.total)}%` }}
                      />
                    </div>
                  </div>
                ))}
                
                {stats.expenseBreakdown.hasMore && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-2 text-sm text-muted-foreground"
                    onClick={() => handleShowAll('expenses')}
                    disabled={isLoading}
                  >
                    {isLoading && showAll.expenses ? (
                      <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <ChevronDown className="h-4 w-4 mr-1" />
                    )}
                    Mostrar todos
                  </Button>
                )}
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
                  <div key={investment.investment} className="space-y-1">
                    <div className="flex justify-between items-center gap-4">
                      <span className="text-sm">{investment.investment}</span>
                      <div className="text-right">
                        <span className="font-medium">{formatCurrency(investment.total)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {getPercentage(investment.total, stats.totalInvestment).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-secondary"
                        style={{ width: `${getPercentage(investment.total, stats.totalInvestment)}%` }}
                      />
                    </div>
                  </div>
                ))}
                
                {stats.investmentPerformance.length >= 5 && !showAll.investments && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-2 text-sm text-muted-foreground"
                    onClick={() => handleShowAll('investments')}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <ChevronDown className="h-4 w-4 mr-1" />
                    )}
                    Mostrar todos
                  </Button>
                )}
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

              <div className="w-full bg-muted rounded-full h-2.5">
                <div 
                  className="bg-primary h-2.5 rounded-full transition-all duration-300"
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
