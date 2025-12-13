"use client"

import { useState } from "react"
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

  // Use a single state object for all filters
  const [filters, setFilters] = useState(() => ({
    search: defaultValues?.search || searchParams.get("search") || "",
    accion: defaultValues?.accion !== undefined
      ? defaultValues.accion
      : searchParams.get("accion") || "todos",
    fromDate: defaultValues?.fromDate || (searchParams.get("from") ? new Date(searchParams.get("from") as string) : undefined),
    toDate: defaultValues?.toDate || (searchParams.get("to") ? new Date(searchParams.get("to") as string) : undefined),
  }));

  const handleSearch = () => {
    const { search, accion, fromDate, toDate } = filters;
    const filterObj = {
      search,
      accion,
      from: fromDate,
      to: toDate
    };
    if (onSearch) {
      // Use callback if provided
      onSearch(filterObj)
    } else {
      // Default behavior: update URL
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (accion && accion !== 'todos') params.set("accion", accion);
      if (fromDate) {
        const year = fromDate.getFullYear();
        const month = String(fromDate.getMonth() + 1).padStart(2, '0');
        const day = String(fromDate.getDate()).padStart(2, '0');
        params.set("from", `${year}-${month}-${day}`);
      }
      if (toDate) {
        const year = toDate.getFullYear();
        const month = String(toDate.getMonth() + 1).padStart(2, '0');
        const day = String(toDate.getDate()).padStart(2, '0');
        params.set("to", `${year}-${month}-${day}`);
      }
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  const handleReset = () => {
    setFilters({ search: "", accion: "todos", fromDate: undefined, toDate: undefined });
    if (onSearch) {
      onSearch({ search: "", accion: "todos" });
    } else {
      router.push(pathname);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-col gap-4 md:flex-row w-full">
        <div className="flex-1">
          <Input
            placeholder="Buscar por descripción o plataforma..."
            value={filters.search}
            onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="w-full"
          />
        </div>

        {showActionFilter && (
          <div className="w-full md:w-[180px]">
            <Select value={filters.accion} onValueChange={value => setFilters(prev => ({ ...prev, accion: value }))}>
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
                {filters.fromDate ? format(filters.fromDate, "dd/MM/yyyy") : "Fecha desde"}
                {filters.fromDate && (
                  <X
                    className="ml-auto h-4 w-4 opacity-50 hover:opacity-100"
                    onClick={e => {
                      e.stopPropagation()
                      setFilters(prev => ({ ...prev, fromDate: undefined }))
                    }}
                  />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.fromDate}
                onSelect={date => setFilters(prev => ({ ...prev, fromDate: date }))}
                autoFocus
                captionLayout="dropdown"
                locale={es}
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.toDate ? format(filters.toDate, "dd/MM/yyyy") : "Fecha hasta"}
                {filters.toDate && (
                  <X
                    className="ml-auto h-4 w-4 opacity-50 hover:opacity-100"
                    onClick={e => {
                      e.stopPropagation()
                      setFilters(prev => ({ ...prev, toDate: undefined }))
                    }}
                  />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.toDate}
                onSelect={date => setFilters(prev => ({ ...prev, toDate: date }))}
                autoFocus
                locale={es}
                captionLayout="dropdown"
                disabled={date => filters.fromDate ? date < filters.fromDate : false}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setFilters(prev => ({ ...prev, fromDate: startOfMonth(subMonths(new Date(), 0)), toDate: endOfMonth(new Date()) }))}>
            Este mes
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFilters(prev => ({ ...prev, fromDate: startOfMonth(subMonths(new Date(), 2)), toDate: endOfMonth(new Date()) }))}>
            3 meses
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFilters(prev => ({ ...prev, fromDate: startOfMonth(subMonths(new Date(), 5)), toDate: endOfMonth(new Date()) }))}>
            6 meses
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFilters(prev => ({ ...prev, fromDate: startOfMonth(subMonths(new Date(), 11)), toDate: endOfMonth(new Date()) }))}>
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
