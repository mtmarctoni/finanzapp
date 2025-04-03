import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getSummaryStats } from "@/lib/server-data" // Import from server-data instead
import { formatCurrency } from "@/lib/utils"
import { ArrowDownIcon, ArrowUpIcon, TrendingUpIcon } from "lucide-react"

export default async function Dashboard() {
  const stats = await getSummaryStats()

  return (
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
          <CardTitle className="text-sm font-medium">Total Inversiones</CardTitle>
          <TrendingUpIcon className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.totalInvestment)}</div>
          <p className="text-xs text-muted-foreground">{stats.investmentCount} transacciones</p>
        </CardContent>
      </Card>
    </div>
  )
}

