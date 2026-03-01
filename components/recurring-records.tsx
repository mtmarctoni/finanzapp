'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import {
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Pencil,
  Plus,
  Repeat,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { RecurringRecord } from '@/types/finance'
import { useToast } from '@/hooks/use-toast'
import { CATEGORIES } from '@/types/categories'
import { cn, formatCurrency } from '@/lib/utils'

interface GenerateError {
  error: string
  details?: string
}

type FilterState = 'all' | 'active' | 'inactive'
type SortState = 'name' | 'amount' | 'day'

const frequencyLabel: Record<RecurringRecord['frequency'], string> = {
  monthly: 'Mensual',
  weekly: 'Semanal',
  biweekly: 'Cada 2 semanas',
  yearly: 'Anual',
}

export default function RecurringRecords() {
  const [recurringRecords, setRecurringRecords] = useState<RecurringRecord[]>([])
  const [newRecord, setNewRecord] = useState({
    name: '',
    accion: '',
    tipo: '',
    detalle1: '',
    detalle2: '',
    amount: '0',
    frequency: 'monthly',
    active: true,
    dia: 1,
    plataforma_pago: 'any',
  })
  const [editingRecord, setEditingRecord] = useState<RecurringRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [generateDate, setGenerateDate] = useState(new Date())
  const [filter, setFilter] = useState<FilterState>('all')
  const [sortBy, setSortBy] = useState<SortState>('day')
  const [search, setSearch] = useState('')
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const { toast } = useToast()

  const resetForm = () => {
    setEditingRecord(null)
    setNewRecord({
      name: '',
      accion: '',
      tipo: '',
      detalle1: '',
      detalle2: '',
      amount: '0',
      frequency: 'monthly',
      active: true,
      dia: 1,
      plataforma_pago: 'any',
    })
  }

  const fetchRecurringRecords = useCallback(async () => {
    try {
      const response = await fetch('/api/recurring')
      if (!response.ok) throw new Error('Failed to fetch recurring records')
      const data = await response.json()
      setRecurringRecords(data)
    } catch (error: unknown) {
      console.error('Error fetching recurring records:', error)
      toast({
        title: 'Error',
        description: 'Error al cargar los registros recurrentes',
        variant: 'destructive',
      })
    }
  }, [toast])

  useEffect(() => {
    fetchRecurringRecords()
  }, [fetchRecurringRecords])

  useEffect(() => {
    if (!recurringRecords.length) {
      setSelectedRecordId(null)
      return
    }

    const exists = recurringRecords.some((record) => record.id === selectedRecordId)
    if (!exists) {
      setSelectedRecordId(recurringRecords[0].id)
    }
  }, [recurringRecords, selectedRecordId])

  const handleAddRecord = async () => {
    if (!newRecord.name || !newRecord.amount || !newRecord.accion || !newRecord.tipo) {
      toast({
        title: 'Datos incompletos',
        description: 'Completa nombre, acción, categoría y monto para crear el registro.',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRecord.name,
          accion: newRecord.accion,
          tipo: newRecord.tipo,
          detalle1: newRecord.detalle1,
          detalle2: newRecord.detalle2,
          amount: parseFloat(newRecord.amount),
          frequency: newRecord.frequency,
          active: newRecord.active,
          dia: newRecord.dia,
          plataforma_pago: newRecord.plataforma_pago,
        }),
      })

      if (!response.ok) throw new Error('Failed to add recurring record')

      resetForm()
      setFormOpen(false)
      await fetchRecurringRecords()
      toast({
        title: 'Éxito',
        description: 'Registro recurrente añadido correctamente',
      })
    } catch (error: unknown) {
      console.error('Error adding recurring record:', error)
      toast({
        title: 'Error',
        description: 'Error al añadir el registro recurrente',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEditRecord = (record: RecurringRecord) => {
    setEditingRecord(record)
    setFormOpen(true)
    setNewRecord({
      name: record.name,
      accion: record.accion,
      tipo: record.tipo || '',
      detalle1: record.detalle1 || '',
      detalle2: record.detalle2 || '',
      amount: record.amount.toString(),
      frequency: record.frequency,
      active: record.active,
      dia: record.dia,
      plataforma_pago: record.plataforma_pago,
    })
  }

  const handleUpdateRecord = async () => {
    if (!editingRecord || !newRecord.accion || !newRecord.tipo) return

    try {
      setLoading(true)
      const response = await fetch('/api/recurring', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingRecord.id,
          name: newRecord.name,
          accion: newRecord.accion,
          tipo: newRecord.tipo,
          detalle1: newRecord.detalle1,
          detalle2: newRecord.detalle2,
          amount: parseFloat(newRecord.amount),
          frequency: newRecord.frequency,
          active: newRecord.active,
          dia: newRecord.dia,
          plataforma_pago: newRecord.plataforma_pago,
        }),
      })

      if (!response.ok) throw new Error('Failed to update recurring record')

      resetForm()
      setFormOpen(false)
      await fetchRecurringRecords()
      toast({
        title: 'Éxito',
        description: 'Registro recurrente actualizado correctamente',
      })
    } catch (error: unknown) {
      console.error('Error updating recurring record:', error)
      toast({
        title: 'Error',
        description: 'Error al actualizar el registro recurrente',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRecord = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este registro recurrente?')) return

    try {
      setLoading(true)
      const response = await fetch('/api/recurring', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      if (!response.ok) throw new Error('Failed to delete recurring record')

      await fetchRecurringRecords()
      toast({
        title: 'Éxito',
        description: 'Registro recurrente eliminado correctamente',
      })
    } catch (error: unknown) {
      console.error('Error deleting recurring record:', error)
      toast({
        title: 'Error',
        description: 'Error al eliminar el registro recurrente',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateRecords = async () => {
    if (!confirm('¿Generar ahora los registros recurrentes para la fecha seleccionada?')) return

    try {
      setLoading(true)
      const response = await fetch('/api/recurring/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: format(generateDate, 'yyyy-MM-dd'),
        }),
      })

      if (!response.ok) {
        const errorData = (await response.json()) as GenerateError
        throw new Error(errorData.details || 'Failed to generate recurring records')
      }

      const result = await response.json()
      toast({
        title: 'Éxito',
        description: `Generados ${result.generated} registros`,
      })
      await fetchRecurringRecords()
    } catch (error: unknown) {
      console.error('Error generating recurring records:', error)
      toast({
        title: 'Error',
        description: 'Error al generar los registros recurrentes',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const totalRecords = recurringRecords.length
  const activeRecords = recurringRecords.filter((record) => record.active).length
  const inactiveRecords = totalRecords - activeRecords
  const monthlyEstimate = recurringRecords
    .filter((record) => record.active && record.frequency === 'monthly')
    .reduce((sum, record) => sum + record.amount, 0)

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    const byFilter = recurringRecords.filter((record) => {
      if (filter === 'active') return record.active
      if (filter === 'inactive') return !record.active
      return true
    })

    const bySearch = byFilter.filter((record) => {
      if (!normalizedSearch) return true
      const content = [
        record.name,
        record.accion,
        record.tipo,
        record.plataforma_pago,
        record.detalle1,
        record.detalle2,
      ]
        .join(' ')
        .toLowerCase()
      return content.includes(normalizedSearch)
    })

    return [...bySearch].sort((left, right) => {
      if (sortBy === 'name') return left.name.localeCompare(right.name)
      if (sortBy === 'amount') return right.amount - left.amount
      return left.dia - right.dia
    })
  }, [filter, recurringRecords, search, sortBy])

  const selectedRecord = filteredRecords.find((record) => record.id === selectedRecordId) ?? null

  return (
    <div className="space-y-6">
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

      <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <Input
              type="date"
              value={format(generateDate, 'yyyy-MM-dd')}
              onChange={(e) => setGenerateDate(new Date(e.target.value))}
              className="w-full sm:w-48"
            />
            <Button onClick={handleGenerateRecords} disabled={loading}>
              <CalendarDays className="mr-2 h-4 w-4" />
              Generar registros
            </Button>
          </div>

          <Collapsible open={formOpen} onOpenChange={setFormOpen}>
            <CollapsibleTrigger asChild>
              <Button variant={formOpen ? 'secondary' : 'default'}>
                <Plus className="mr-2 h-4 w-4" />
                {editingRecord ? 'Editando registro' : 'Nuevo registro'}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 border rounded-lg p-4 sm:p-5 space-y-4">
              <h3 className="font-semibold text-lg">
                {editingRecord ? 'Editar registro recurrente' : 'Crear registro recurrente'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Nombre</label>
                  <Input
                    value={newRecord.name}
                    onChange={(e) => setNewRecord({ ...newRecord, name: e.target.value })}
                    placeholder="Ej: Alquiler"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">Tipo de transacción</label>
                  <Select
                    value={newRecord.accion}
                    onValueChange={(value) => setNewRecord({ ...newRecord, accion: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ingreso">Ingreso</SelectItem>
                      <SelectItem value="Gasto">Gasto</SelectItem>
                      <SelectItem value="Inversión">Inversión</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">Día del mes</label>
                  <Select
                    value={newRecord.dia.toString()}
                    onValueChange={(value) => setNewRecord({ ...newRecord, dia: parseInt(value, 10) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar día" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                        <SelectItem key={day} value={day.toString()}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">Categoría</label>
                  <Select
                    value={newRecord.tipo}
                    onValueChange={(value) => setNewRecord({ ...newRecord, tipo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">Monto</label>
                  <Input
                    type="number"
                    value={newRecord.amount}
                    onChange={(e) => setNewRecord({ ...newRecord, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-medium">Detalle 1</label>
                  <Input
                    value={newRecord.detalle1}
                    onChange={(e) => setNewRecord({ ...newRecord, detalle1: e.target.value })}
                    placeholder="Detalle principal"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-medium">Detalle 2</label>
                  <Input
                    value={newRecord.detalle2}
                    onChange={(e) => setNewRecord({ ...newRecord, detalle2: e.target.value })}
                    placeholder="Detalle adicional"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">Frecuencia</label>
                  <Select
                    value={newRecord.frequency}
                    onValueChange={(value) => setNewRecord({ ...newRecord, frequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar frecuencia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensual</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="biweekly">Cada 2 semanas</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 lg:col-span-2">
                  <label className="block text-sm font-medium">Plataforma de pago</label>
                  <Input
                    value={newRecord.plataforma_pago}
                    onChange={(e) => setNewRecord({ ...newRecord, plataforma_pago: e.target.value })}
                    placeholder="Ej: Transferencia, Tarjeta"
                  />
                </div>

                <div className="space-y-2 lg:col-span-1">
                  <label className="block text-sm font-medium">Estado</label>
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2 h-10">
                    <Checkbox
                      checked={newRecord.active}
                      onCheckedChange={(checked) => setNewRecord({ ...newRecord, active: checked as boolean })}
                    />
                    <span className="text-sm">Activo</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    resetForm()
                    setFormOpen(false)
                  }}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={editingRecord ? handleUpdateRecord : handleAddRecord}
                  disabled={loading}
                >
                  {editingRecord ? 'Guardar cambios' : 'Añadir registro'}
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, categoría, plataforma o detalle..."
              className="pl-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Select value={filter} onValueChange={(value) => setFilter(value as FilterState)}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortState)}>
              <SelectTrigger>
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Día</SelectItem>
                <SelectItem value="amount">Monto</SelectItem>
                <SelectItem value="name">Nombre</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border bg-card p-3 sm:p-4 space-y-2 max-h-155 overflow-y-auto">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No se encontraron registros para este filtro.
            </div>
          ) : (
            filteredRecords.map((record) => {
              const isSelected = record.id === selectedRecordId

              return (
                <HoverCard key={record.id} openDelay={120} closeDelay={100}>
                  <HoverCardTrigger asChild>
                    <button
                      type="button"
                      onMouseEnter={() => setSelectedRecordId(record.id)}
                      onFocus={() => setSelectedRecordId(record.id)}
                      onClick={() => setSelectedRecordId(record.id)}
                      className={cn(
                        'w-full text-left rounded-lg border px-3 py-3 transition-all',
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-primary/40 hover:bg-muted/40'
                      )}
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
                                handleEditRecord(record)
                              }}
                              disabled={loading}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteRecord(record.id)
                              }}
                              disabled={loading}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </button>
                  </HoverCardTrigger>

                  <HoverCardContent align="start" className="w-80">
                    <div className="space-y-2">
                      <p className="font-semibold">{record.name}</p>
                      <p className="text-sm text-muted-foreground">{record.accion} · {record.tipo}</p>
                      <div className="text-sm grid gap-1">
                        <p><span className="font-medium">Monto:</span> {formatCurrency(record.amount)}</p>
                        <p><span className="font-medium">Frecuencia:</span> {frequencyLabel[record.frequency]}</p>
                        <p><span className="font-medium">Día:</span> {record.dia}</p>
                        <p><span className="font-medium">Plataforma:</span> {record.plataforma_pago}</p>
                        {record.detalle1 ? <p><span className="font-medium">Detalle 1:</span> {record.detalle1}</p> : null}
                        {record.detalle2 ? <p><span className="font-medium">Detalle 2:</span> {record.detalle2}</p> : null}
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              )
            })
          )}
        </div>

        <aside className="rounded-xl border bg-card p-4 sm:p-5 lg:sticky lg:top-4 h-fit">
          {selectedRecord ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Detalle del registro</p>
                <h3 className="text-xl font-semibold mt-1">{selectedRecord.name}</h3>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <Badge variant={selectedRecord.active ? 'default' : 'secondary'}>
                    {selectedRecord.active ? 'Activo' : 'Inactivo'}
                  </Badge>
                  <Badge variant="outline">{frequencyLabel[selectedRecord.frequency]}</Badge>
                </div>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                  <span className="text-muted-foreground">Monto</span>
                  <span className="font-medium">{formatCurrency(selectedRecord.amount)}</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                  <span className="text-muted-foreground">Transacción</span>
                  <span className="font-medium">{selectedRecord.accion}</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                  <span className="text-muted-foreground">Categoría</span>
                  <span className="font-medium">{selectedRecord.tipo}</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                  <span className="text-muted-foreground">Día de ejecución</span>
                  <span className="font-medium">{selectedRecord.dia}</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                  <span className="text-muted-foreground">Plataforma</span>
                  <span className="font-medium">{selectedRecord.plataforma_pago}</span>
                </div>
              </div>

              {(selectedRecord.detalle1 || selectedRecord.detalle2) && (
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="font-medium">Detalles</p>
                  {selectedRecord.detalle1 ? (
                    <p className="text-sm text-muted-foreground">{selectedRecord.detalle1}</p>
                  ) : null}
                  {selectedRecord.detalle2 ? (
                    <p className="text-sm text-muted-foreground">{selectedRecord.detalle2}</p>
                  ) : null}
                </div>
              )}

              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => handleEditRecord(selectedRecord)} disabled={loading}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
                <Button
                  className="flex-1"
                  variant="destructive"
                  onClick={() => handleDeleteRecord(selectedRecord.id)}
                  disabled={loading}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              Pasa el cursor por un registro para ver su detalle instantáneo.
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
