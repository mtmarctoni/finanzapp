/**
 * Core finance entry type representing a financial transaction
 */
export type Entry = {
  id: string
  fecha: string
  tipo: string
  accion: string
  que: string
  plataforma_pago: string
  cantidad: number
  detalle1: string | null
  detalle2: string | null
  created_at: string
  updated_at: string
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

/**
 * Recurring record type
 */
export type RecurringRecord = {
  /**
   * Unique identifier for the recurring record
   */
  id: string
  /**
   * Name of the recurring record
   */
  name: string
  /**
   * Type of transaction (Ingreso, Gasto, Inversión)
   */
  accion: 'Ingreso' | 'Gasto' | 'Inversión'
  /**
   * Type of transaction (e.g. 'Ingreso', 'Gasto', 'Inversión')
   */
  tipo: string
  /**
   * First detail of the recurring record
   */
  detalle1: string
  /**
   * Second detail of the recurring record
   */
  detalle2: string
  /**
   * Amount of the recurring record
   */
  amount: number
  /**
   * Frequency of the recurring record (monthly, weekly, biweekly, or yearly)
   */
  frequency: 'monthly' | 'weekly' | 'biweekly' | 'yearly'
  /**
   * Whether the recurring record is active or not
   */
  active: boolean
  /**
   * Day of the month for the recurring record
   */
  dia: number
  /**
   * Payment platform of the recurring record
   */
  plataforma_pago: string
  /**
   * Date of the last generated transaction (null if never generated)
   */
  lastGenerated: string | null
  /**
   * Date the recurring record was created
   */
  createdAt: string
  /**
   * Date the recurring record was last updated
   */
  updatedAt: string
}
