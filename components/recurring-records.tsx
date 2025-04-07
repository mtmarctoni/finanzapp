'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RecurringRecord } from '@/types/finance'
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { format } from 'date-fns'
import { useToast } from "@/hooks/use-toast"
import { CATEGORIES } from "@/types/categories"

interface GenerateError {
  error: string
  details?: string
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
    plataforma_pago: 'any' 
  })
  const [editingRecord, setEditingRecord] = useState<RecurringRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [generateDate, setGenerateDate] = useState(new Date())
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const { toast } = useToast()

  useEffect(() => {
    fetchRecurringRecords()
  }, [])

  const fetchRecurringRecords = async () => {
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
        variant: 'destructive'
      })
    }
  }

  const handleAddRecord = async () => {
    if (!newRecord.name || !newRecord.amount || !newRecord.accion) return

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
          plataforma_pago: newRecord.plataforma_pago
        })
      })

      if (!response.ok) throw new Error('Failed to add recurring record')
      
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
        plataforma_pago: 'any' 
      })
      fetchRecurringRecords()
      toast({
        title: 'Éxito',
        description: 'Registro recurrente añadido correctamente',
        variant: 'default'
      })
    } catch (error: unknown) {
      console.error('Error adding recurring record:', error)
      toast({
        title: 'Error',
        description: 'Error al añadir el registro recurrente',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEditRecord = async (record: RecurringRecord) => {
    setEditingRecord(record)
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
      plataforma_pago: record.plataforma_pago
    })
  }

  const handleUpdateRecord = async () => {
    if (!editingRecord || !newRecord.accion) return

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
          plataforma_pago: newRecord.plataforma_pago
        })
      })

      if (!response.ok) throw new Error('Failed to update recurring record')
      
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
        plataforma_pago: 'any' 
      })
      fetchRecurringRecords()
      toast({
        title: 'Éxito',
        description: 'Registro recurrente actualizado correctamente',
        variant: 'default'
      })
    } catch (error: unknown) {
      console.error('Error updating recurring record:', error)
      toast({
        title: 'Error',
        description: 'Error al actualizar el registro recurrente',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRecord = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este registro recurrente?')) return

    try {
      setLoading(true)
      const response = await fetch('/api/recurring', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })

      if (!response.ok) throw new Error('Failed to delete recurring record')
      
      fetchRecurringRecords()
      toast({
        title: 'Éxito',
        description: 'Registro recurrente eliminado correctamente',
        variant: 'default'
      })
    } catch (error: unknown) {
      console.error('Error deleting recurring record:', error)
      toast({
        title: 'Error',
        description: 'Error al eliminar el registro recurrente',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateRecords = async () => {
    if (!confirm('¿Estás seguro de que deseas generar los registros recurrentes para hoy?')) return

    try {
      setLoading(true)
      const response = await fetch('/api/recurring/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: format(generateDate, 'yyyy-MM-dd')
        })
      })

      if (!response.ok) {
        const errorData = await response.json() as GenerateError
        throw new Error(errorData.details || 'Failed to generate recurring records')
      }
      
      const result = await response.json()
      toast({
        title: 'Éxito',
        description: `Generados ${result.generated} registros`,
        variant: 'default'
      })
      fetchRecurringRecords()
    } catch (error: unknown) {
      console.error('Error generating recurring records:', error)
      toast({
        title: 'Error',
        description: 'Error al generar los registros recurrentes',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredRecords = recurringRecords.filter(record => {
    if (filter === 'all') return true
    if (filter === 'active') return record.active
    if (filter === 'inactive') return !record.active
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Registros Recurrentes</h2>
        <div className="flex space-x-4">
          <Input
            type="date"
            value={format(generateDate, 'yyyy-MM-dd')}
            onChange={(e) => setGenerateDate(new Date(e.target.value))}
            className="w-48"
          />
          <Button onClick={handleGenerateRecords} disabled={loading}>
            Generar Registros
          </Button>
          <Select value={filter} onValueChange={(value) => setFilter(value as 'all' | 'active' | 'inactive')}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Mostrar todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mostrar todos</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        {/* Add/Edit Record Form */}
        <div className="bg-card rounded-lg p-6">
          <h3 className="font-semibold mb-6 text-lg">{editingRecord ? 'Editar Registro Recurrente' : 'Añadir Nuevo Registro Recurrente'}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Basic Information */}
            <div className="space-y-3">
              <label className="block text-sm font-medium mb-1">Nombre</label>
              <Input
                value={newRecord.name}
                onChange={(e) => setNewRecord({ ...newRecord, name: e.target.value })}
                placeholder="Nombre del registro"
                className="w-full"
              />
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium mb-1">Tipo de Transacción</label>
              <Select
                value={newRecord.accion}
                onValueChange={(value) => setNewRecord({ ...newRecord, accion: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ingreso">Ingreso</SelectItem>
                  <SelectItem value="Gasto">Gasto</SelectItem>
                  <SelectItem value="Inversión">Inversión</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium mb-1">Día del Mes</label>
              <Select
                value={newRecord.dia.toString()}
                onValueChange={(value) => setNewRecord({ ...newRecord, dia: parseInt(value) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar día" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31].map((day) => (
                    <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium mb-1">Categoría</label>
              <Select
                value={newRecord.tipo}
                onValueChange={(value) => setNewRecord({ ...newRecord, tipo: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount and Details */}
            <div className="space-y-3">
              <label className="block text-sm font-medium mb-1">Monto</label>
              <Input
                type="number"
                value={newRecord.amount}
                onChange={(e) => setNewRecord({ ...newRecord, amount: e.target.value })}
                placeholder="Monto"
                className="w-full"
              />
            </div>

            <div className="space-y-3 col-span-2">
              <label className="block text-sm font-medium mb-1">Detalle 1</label>
              <Input
                value={newRecord.detalle1}
                onChange={(e) => setNewRecord({ ...newRecord, detalle1: e.target.value })}
                placeholder="Detalle 1"
                className="w-full"
              />
            </div>

            <div className="space-y-3 col-span-2">
              <label className="block text-sm font-medium mb-1">Detalle 2</label>
              <Input
                value={newRecord.detalle2}
                onChange={(e) => setNewRecord({ ...newRecord, detalle2: e.target.value })}
                placeholder="Detalle 2"
                className="w-full"
              />
            </div>

            {/* Frequency and Payment Platform */}
            <div className="space-y-3">
              <label className="block text-sm font-medium mb-1">Frecuencia</label>
              <Select
                value={newRecord.frequency}
                onValueChange={(value) => setNewRecord({ ...newRecord, frequency: value })}
              >
                <SelectTrigger className="w-full">
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

            <div className="space-y-3 col-span-2">
              <label className="block text-sm font-medium mb-1">Plataforma de Pago</label>
              <Input
                value={newRecord.plataforma_pago}
                onChange={(e) => setNewRecord({ ...newRecord, plataforma_pago: e.target.value })}
                placeholder="Plataforma de pago (ej: PayPal, Transferencia, etc.)"
                className="w-full"
              />
            </div>

            {/* Active Status */}
            <div className="space-y-3 col-span-4">
              <label className="block text-sm font-medium mb-1">Activo</label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={newRecord.active}
                  onCheckedChange={(checked) => setNewRecord({ ...newRecord, active: checked as boolean })}
                />
                <span className="text-sm">Marcar como activo</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
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
                  plataforma_pago: 'any' 
                })
              }}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={editingRecord ? handleUpdateRecord : handleAddRecord}
              disabled={loading}
            >
              {editingRecord ? 'Guardar Cambios' : 'Añadir Registro'}
            </Button>
          </div>
        </div>

        {/* Recurring Records List */}
        <div className="space-y-4">
          <h3 className="font-semibold">Registros Recurrentes</h3>
          <div className="space-y-2">
            {filteredRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron registros recurrentes
              </div>
            ) : (
              filteredRecords.map((record) => (
                <div key={record.id} className="flex justify-between items-center p-4 bg-card rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div>
                      <h4 className="font-medium">{record.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {record.accion} - {record.tipo} - {record.frequency} - {record.plataforma_pago}
                      </p>
                      <div className="mt-1">
                        <Badge variant={record.active ? "default" : "secondary"}>
                          {record.active ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditRecord(record)}
                        disabled={loading}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteRecord(record.id)}
                        disabled={loading}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
