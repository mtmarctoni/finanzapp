import { format } from 'date-fns'
import { CalendarDays, Plus, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FilterState, SortState } from '@/components/recurring/types'

interface RecordsControlsProps {
  loading: boolean
  formOpen: boolean
  isEditing: boolean
  generateDate: Date
  search: string
  filter: FilterState
  sortBy: SortState
  resultsCount: number
  hasActiveFilters: boolean
  onGenerateDateChange: (date: Date) => void
  onGenerateRecords: () => void
  onToggleForm: () => void
  onSearchChange: (value: string) => void
  onFilterChange: (value: FilterState) => void
  onSortChange: (value: SortState) => void
  onClearFilters: () => void
}

export function RecordsControls({
  loading,
  formOpen,
  isEditing,
  generateDate,
  search,
  filter,
  sortBy,
  resultsCount,
  hasActiveFilters,
  onGenerateDateChange,
  onGenerateRecords,
  onToggleForm,
  onSearchChange,
  onFilterChange,
  onSortChange,
  onClearFilters,
}: RecordsControlsProps) {
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Input
            type="date"
            value={format(generateDate, 'yyyy-MM-dd')}
            onChange={(e) => onGenerateDateChange(new Date(e.target.value))}
            className="w-full sm:w-48"
          />
          <Button onClick={onGenerateRecords} disabled={loading}>
            <CalendarDays className="mr-2 h-4 w-4" />
            Generar registros
          </Button>
        </div>

        <Button variant={formOpen ? 'secondary' : 'default'} onClick={onToggleForm}>
          <Plus className="mr-2 h-4 w-4" />
          {isEditing ? 'Editando registro' : 'Nuevo registro'}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre, categoría, plataforma o detalle..."
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select value={filter} onValueChange={(value) => onFilterChange(value as FilterState)}>
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value) => onSortChange(value as SortState)}>
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

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{resultsCount} registros encontrados</span>
        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            Limpiar filtros
          </Button>
        ) : null}
      </div>
    </div>
  )
}
