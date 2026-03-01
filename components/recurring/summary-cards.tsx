import { CircleDollarSign, Clock3, Repeat, Sparkles } from 'lucide-react'

import { formatCurrency } from '@/lib/utils'

interface SummaryCardsProps {
  totalRecords: number
  activeRecords: number
  inactiveRecords: number
  monthlyEstimate: number
}

export function SummaryCards({
  totalRecords,
  activeRecords,
  inactiveRecords,
  monthlyEstimate,
}: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Repeat className="h-4 w-4" />
          Registros
        </div>
        <p className="mt-2 text-2xl font-semibold">{totalRecords}</p>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Sparkles className="h-4 w-4" />
          Activos
        </div>
        <p className="mt-2 text-2xl font-semibold">{activeRecords}</p>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Clock3 className="h-4 w-4" />
          Inactivos
        </div>
        <p className="mt-2 text-2xl font-semibold">{inactiveRecords}</p>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <CircleDollarSign className="h-4 w-4" />
          Estimado mensual
        </div>
        <p className="mt-2 text-2xl font-semibold">{formatCurrency(monthlyEstimate)}</p>
      </div>
    </div>
  )
}
