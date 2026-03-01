import { Pencil, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { frequencyLabel } from '@/components/recurring/constants'
import { cn, formatCurrency } from '@/lib/utils'
import { RecurringRecord } from '@/types/finance'

interface RecordsListProps {
  records: RecurringRecord[]
  selectedRecordId: string | null
  loading: boolean
  onSelectRecord: (id: string) => void
  onEditRecord: (record: RecurringRecord) => void
  onDeleteRecord: (id: string) => void
}

function RecordPreview({ record }: { record: RecurringRecord }) {
  return (
    <div className="space-y-2">
      <p className="font-semibold">{record.name}</p>
      <p className="text-sm text-muted-foreground">
        {record.accion} · {record.tipo}
      </p>
      <div className="text-sm grid gap-1">
        <p>
          <span className="font-medium">Monto:</span> {formatCurrency(record.amount)}
        </p>
        <p>
          <span className="font-medium">Frecuencia:</span> {frequencyLabel[record.frequency]}
        </p>
        <p>
          <span className="font-medium">Día:</span> {record.dia}
        </p>
        <p>
          <span className="font-medium">Plataforma:</span> {record.plataforma_pago}
        </p>
        {record.detalle1 ? (
          <p>
            <span className="font-medium">Detalle 1:</span> {record.detalle1}
          </p>
        ) : null}
        {record.detalle2 ? (
          <p>
            <span className="font-medium">Detalle 2:</span> {record.detalle2}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function RecordItem({
  record,
  isSelected,
  loading,
  onSelectRecord,
  onEditRecord,
  onDeleteRecord,
}: {
  record: RecurringRecord
  isSelected: boolean
  loading: boolean
  onSelectRecord: (id: string) => void
  onEditRecord: (record: RecurringRecord) => void
  onDeleteRecord: (id: string) => void
}) {
  return (
    <HoverCard openDelay={120} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={() => onSelectRecord(record.id)}
          className={cn(
            'w-full text-left rounded-lg border px-3 py-3 transition-all',
            isSelected
              ? 'border-primary bg-primary/10 shadow-sm'
              : 'border-border hover:border-primary/40 hover:bg-muted/30'
          )}
          aria-pressed={isSelected}
          aria-label={`Seleccionar ${record.name}`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-medium truncate">{record.name}</h4>
                <Badge variant={record.active ? 'default' : 'secondary'}>
                  {record.active ? 'Activo' : 'Inactivo'}
                </Badge>
                <Badge variant="outline">{frequencyLabel[record.frequency]}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {record.accion} · {record.tipo} · Día {record.dia} · {record.plataforma_pago}
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <span className="font-semibold">{formatCurrency(record.amount)}</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditRecord(record)
                  }}
                  disabled={loading}
                  aria-label={`Editar ${record.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteRecord(record.id)
                  }}
                  disabled={loading}
                  aria-label={`Eliminar ${record.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </button>
      </HoverCardTrigger>

      <HoverCardContent align="start" className="w-80">
        <RecordPreview record={record} />
      </HoverCardContent>
    </HoverCard>
  )
}

export function RecordsList({
  records,
  selectedRecordId,
  loading,
  onSelectRecord,
  onEditRecord,
  onDeleteRecord,
}: RecordsListProps) {
  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No se encontraron registros para este filtro.
      </div>
    )
  }

  return (
    <div className="lg:col-span-2 rounded-xl border bg-card p-3 sm:p-4 space-y-2 max-h-155 overflow-y-auto">
      {records.map((record) => (
        <RecordItem
          key={record.id}
          record={record}
          isSelected={record.id === selectedRecordId}
          loading={loading}
          onSelectRecord={onSelectRecord}
          onEditRecord={onEditRecord}
          onDeleteRecord={onDeleteRecord}
        />
      ))}
    </div>
  )
}
