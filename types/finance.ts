/**
 * Core finance entry type representing a financial transaction
 */
export type Entry = {
  id: string
  fecha: string
  tipo: string
  accion: string
  que: string
  plataformaPago: string
  cantidad: number
  detalle1: string | null
  detalle2: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Summary statistics for the dashboard
 */
export type SummaryStats = {
  totalIncome: number
  incomeCount: number
  totalExpense: number
  expenseCount: number
  totalInvestment: number
  investmentCount: number
  netBalance: number
  monthlyData: MonthlyData[]
}

/**
 * Monthly aggregated data for charts
 */
export type MonthlyData = {
  month: string
  income: number
  expense: number
  investment: number
}

/**
 * Transaction types
 */
export type TransactionType = 'Ingreso' | 'Gasto' | 'Inversión' | 'todos';
