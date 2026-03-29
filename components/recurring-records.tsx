'use client'

import { useEffect, useMemo, useState } from 'react'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { RecordDetailPanel } from '@/components/recurring/record-detail-panel'
import { RecordForm } from '@/components/recurring/record-form'
import { RecordsControls } from '@/components/recurring/records-controls'
import { RecordsList } from '@/components/recurring/records-list'
import { SummaryCards } from '@/components/recurring/summary-cards'
import { useRecurringRecords } from '@/components/recurring/use-recurring-records'
import { INITIAL_RECURRING_FORM, FilterState, RecurringFormData, SortState } from '@/components/recurring/types'
import { calculateMonthlyEstimate } from '@/components/recurring/utils'
import { RecurringRecord } from '@/types/finance'
import { useToast } from '@/hooks/use-toast'

export default function RecurringRecords() {
  const { recurringRecords, loading, addRecord, updateRecord, deleteRecord, generateRecords } = useRecurringRecords()
  const { toast } = useToast()

  const [formData, setFormData] = useState<RecurringFormData>(INITIAL_RECURRING_FORM)
  const [editingRecord, setEditingRecord] = useState<RecurringRecord | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [filter, setFilter] = useState<FilterState>('all')
  const [sortBy, setSortBy] = useState<SortState>('day')
  const [search, setSearch] = useState('')
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [generateDate, setGenerateDate] = useState(new Date())

  const resetForm = () => {
    setEditingRecord(null)
    setFormData(INITIAL_RECURRING_FORM)
  }

  useEffect(() => {
    // Use a microtask to avoid setting state synchronously in effect body
    if (!recurringRecords.length) {
      queueMicrotask(() => setSelectedRecordId(null))
      return
    }

    const selectedExists = recurringRecords.some((record) => record.id === selectedRecordId)
    if (!selectedExists) {
      queueMicrotask(() => setSelectedRecordId(recurringRecords[0]?.id ?? null))
    }
  }, [recurringRecords, selectedRecordId])

  const validateForm = () => {
    if (!formData.name || !formData.amount || !formData.accion || !formData.tipo) {
      toast({
        title: 'Datos incompletos',
        description: 'Completa nombre, acción, categoría y monto para crear el registro.',
        variant: 'destructive',
      })
      return false
    }
    return true
  }

  const handleAddRecord = async () => {
    if (!validateForm()) return

    const ok = await addRecord(formData)
    if (ok) {
      resetForm()
      setFormOpen(false)
    }
  }

  const handleEditRecord = (record: RecurringRecord) => {
    setEditingRecord(record)
    setFormOpen(true)
    setFormData({
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
    if (!editingRecord || !validateForm()) return

    const ok = await updateRecord(editingRecord.id, formData)
    if (ok) {
      resetForm()
      setFormOpen(false)
    }
  }

  const handleDeleteRecord = async (id: string) => {
    await deleteRecord(id)
  }

  const handleGenerateRecords = async () => {
    await generateRecords(generateDate)
  }

  const totalRecords = recurringRecords.length
  const activeRecords = recurringRecords.filter((record) => record.active).length
  const inactiveRecords = totalRecords - activeRecords
  const monthlyEstimate = useMemo(() => calculateMonthlyEstimate(recurringRecords), [recurringRecords])

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
  const hasActiveFilters = search.trim().length > 0 || filter !== 'all' || sortBy !== 'day'

  return (
    <div className="space-y-6">
      <SummaryCards
        totalRecords={totalRecords}
        activeRecords={activeRecords}
        inactiveRecords={inactiveRecords}
        monthlyEstimate={monthlyEstimate}
      />

      <Collapsible open={formOpen} onOpenChange={setFormOpen}>
        <RecordsControls
          loading={loading}
          formOpen={formOpen}
          isEditing={Boolean(editingRecord)}
          generateDate={generateDate}
          search={search}
          filter={filter}
          sortBy={sortBy}
          resultsCount={filteredRecords.length}
          hasActiveFilters={hasActiveFilters}
          onGenerateDateChange={setGenerateDate}
          onGenerateRecords={handleGenerateRecords}
          onToggleForm={() => setFormOpen((prev) => !prev)}
          onSearchChange={setSearch}
          onFilterChange={setFilter}
          onSortChange={setSortBy}
          onClearFilters={() => {
            setSearch('')
            setFilter('all')
            setSortBy('day')
          }}
        />

        <CollapsibleTrigger className="sr-only">Alternar formulario de registro recurrente</CollapsibleTrigger>
        <CollapsibleContent>
          <RecordForm
            formData={formData}
            loading={loading}
            isEditing={Boolean(editingRecord)}
            onChange={setFormData}
            onCancel={() => {
              resetForm()
              setFormOpen(false)
            }}
            onSubmit={editingRecord ? handleUpdateRecord : handleAddRecord}
          />
        </CollapsibleContent>
      </Collapsible>

      <div className="grid gap-4 lg:grid-cols-3">
        <RecordsList
          records={filteredRecords}
          selectedRecordId={selectedRecordId}
          loading={loading}
          onSelectRecord={setSelectedRecordId}
          onEditRecord={handleEditRecord}
          onDeleteRecord={handleDeleteRecord}
        />

        <RecordDetailPanel
          record={selectedRecord}
          loading={loading}
          onEdit={handleEditRecord}
          onDelete={handleDeleteRecord}
        />
      </div>
    </div>
  )
}
