import { Pencil, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { frequencyLabel } from '@/components/recurring/constants'
import { formatCurrency } from '@/lib/utils'
import { RecurringRecord } from '@/types/finance'

interface RecordDetailPanelProps {
  record: RecurringRecord | null
  loading: boolean
  onEdit: (record: RecurringRecord) => void
  onDelete: (id: string) => void
}

export function RecordDetailPanel({ record, loading, onEdit, onDelete }: RecordDetailPanelProps) {
  return (
    <aside className="rounded-xl border bg-card p-4 sm:p-5 lg:sticky lg:top-4 h-fit">
      {record ? (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Detalle del registro</p>
            <h3 className="text-xl font-semibold mt-1">{record.name}</h3>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Badge variant={record.active ? 'default' : 'secondary'}>
                {record.active ? 'Activo' : 'Inactivo'}
              </Badge>
              <Badge variant="outline">{frequencyLabel[record.frequency]}</Badge>
            </div>
          </div>

          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <span className="text-muted-foreground">Monto</span>
              <span className="font-medium">{formatCurrency(record.amount)}</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <span className="text-muted-foreground">Transacción</span>
              <span className="font-medium">{record.accion}</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <span className="text-muted-foreground">Categoría</span>
              <span className="font-medium">{record.tipo}</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <span className="text-muted-foreground">Día de ejecución</span>
              <span className="font-medium">{record.dia}</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <span className="text-muted-foreground">Plataforma</span>
              <span className="font-medium">{record.plataforma_pago}</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <span className="text-muted-foreground">Quién</span>
              <span className="font-medium">{record.quien || 'Yo'}</span>
            </div>
          </div>

          {(record.detalle1 || record.detalle2) && (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="font-medium">Detalles</p>
              {record.detalle1 ? <p className="text-sm text-muted-foreground">{record.detalle1}</p> : null}
              {record.detalle2 ? <p className="text-sm text-muted-foreground">{record.detalle2}</p> : null}
            </div>
          )}

          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => onEdit(record)} disabled={loading}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
            <Button
              className="flex-1"
              variant="destructive"
              onClick={() => onDelete(record.id)}
              disabled={loading}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-muted-foreground">
          Haz click en un registro para ver su detalle aquí.
        </div>
      )}
    </aside>
  )
}
