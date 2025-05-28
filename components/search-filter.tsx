"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarIcon, SearchIcon, X } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns"
import { es } from "date-fns/locale"

interface SearchFilterProps {
  defaultValues?: {
    search?: string
    accion?: string
    fromDate?: Date
    toDate?: Date
  }
  onSearch?: (filters: {
    search: string
    accion: string
    from?: Date
    to?: Date
  }) => void
  showActionFilter?: boolean
  className?: string
}

export function SearchFilter({
  defaultValues,
  onSearch,
  showActionFilter = true,
  className = ""
}: SearchFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Initialize state from URL params or default values
  const [search, setSearch] = useState(defaultValues?.search || searchParams.get("search") || "")
  const [accion, setAccion] = useState(
    defaultValues?.accion !== undefined 
      ? defaultValues.accion 
      : searchParams.get("accion") || "todos"
  )
  const [fromDate, setFromDate] = useState<Date | undefined>(
    defaultValues?.fromDate || 
    (searchParams.get("from") ? new Date(searchParams.get("from") as string) : undefined)
  )
  const [toDate, setToDate] = useState<Date | undefined>(
    defaultValues?.toDate ||
    (searchParams.get("to") ? new Date(searchParams.get("to") as string) : undefined)
  )

  // Update internal state when defaultValues change
  useEffect(() => {
    if (defaultValues) {
      if (defaultValues.search !== undefined) setSearch(defaultValues.search)
      if (defaultValues.accion !== undefined) setAccion(defaultValues.accion)
      if (defaultValues.fromDate !== undefined) setFromDate(defaultValues.fromDate)
      if (defaultValues.toDate !== undefined) setToDate(defaultValues.toDate)
    }
  }, [defaultValues])

  const handleSearch = () => {
    const filters = {
      search,
      accion,
      from: fromDate,
      to: toDate
    }

    if (onSearch) {
      // Use callback if provided
      onSearch(filters)
    } else {
      // Default behavior: update URL
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (accion && accion !== 'todos') params.set("accion", accion)
      if (fromDate) {
        const year = fromDate.getFullYear()
        const month = String(fromDate.getMonth() + 1).padStart(2, '0')
        const day = String(fromDate.getDate()).padStart(2, '0')
        params.set("from", `${year}-${month}-${day}`)
      }
      if (toDate) {
        const year = toDate.getFullYear()
        const month = String(toDate.getMonth() + 1).padStart(2, '0')
        const day = String(toDate.getDate()).padStart(2, '0')
        params.set("to", `${year}-${month}-${day}`)
      }

      router.push(`${pathname}?${params.toString()}`)
    }
  }

  const handleReset = () => {
    setSearch("")
    setAccion("todos")
    setFromDate(undefined)
    setToDate(undefined)
    
    if (onSearch) {
      onSearch({ search: "", accion: "todos" })
    } else {
      router.push(pathname)
    }
  }

  // Quick date range buttons
  const setDateRange = (months: number) => {
    const today = new Date()
    setFromDate(startOfMonth(subMonths(today, months - 1)))
    setToDate(endOfMonth(today))
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-col gap-4 md:flex-row w-full">
        <div className="flex-1">
          <Input
            placeholder="Buscar por descripción o plataforma..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full"
          />
        </div>
        
        {showActionFilter && (
          <div className="w-full md:w-[180px]">
            <Select value={accion} onValueChange={setAccion}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las acciones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas las acciones</SelectItem>
                <SelectItem value="Ingreso">Ingresos</SelectItem>
                <SelectItem value="Gasto">Gastos</SelectItem>
                <SelectItem value="Inversión">Inversiones</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="flex flex-wrap gap-2 items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {fromDate ? format(fromDate, "dd/MM/yyyy") : "Fecha desde"}
                {fromDate && (
                  <X 
                    className="ml-auto h-4 w-4 opacity-50 hover:opacity-100" 
                    onClick={(e) => {
                      e.stopPropagation()
                      setFromDate(undefined)
                    }} 
                  />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar 
                mode="single" 
                selected={fromDate} 
                onSelect={(date) => {
                  setFromDate(date)
                  // If toDate is before fromDate, update toDate to be the same as fromDate
                  if (date && toDate && date > toDate) {
                    setToDate(date)
                  }
                }} 
                initialFocus 
                locale={es} 
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {toDate ? format(toDate, "dd/MM/yyyy") : "Fecha hasta"}
                {toDate && (
                  <X 
                    className="ml-auto h-4 w-4 opacity-50 hover:opacity-100" 
                    onClick={(e) => {
                      e.stopPropagation()
                      setToDate(undefined)
                    }} 
                  />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar 
                mode="single" 
                selected={toDate} 
                onSelect={(date) => {
                  setToDate(date)
                  // If fromDate is after toDate, update fromDate to be the same as toDate
                  if (date && fromDate && date < fromDate) {
                    setFromDate(date)
                  }
                }} 
                initialFocus 
                locale={es} 
                disabled={(date) => fromDate ? date < fromDate : false}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setDateRange(1)}>
            Este mes
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDateRange(3)}>
            3 meses
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDateRange(6)}>
            6 meses
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDateRange(12)}>
            1 año
          </Button>
        </div>

        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={handleReset}>
            <X className="mr-2 h-4 w-4" />
            Limpiar
          </Button>
          <Button onClick={handleSearch}>
            <SearchIcon className="mr-2 h-4 w-4" />
            Aplicar filtros
          </Button>
        </div>
      </div>
    </div>
  )
}
