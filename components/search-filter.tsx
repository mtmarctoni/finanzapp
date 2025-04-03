"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarIcon, SearchIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export function SearchFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [tipo, setTipo] = useState(searchParams.get("tipo") || "todos")
  const [fromDate, setFromDate] = useState<Date | undefined>(
    searchParams.get("from") ? new Date(searchParams.get("from") as string) : undefined,
  )
  const [toDate, setToDate] = useState<Date | undefined>(
    searchParams.get("to") ? new Date(searchParams.get("to") as string) : undefined,
  )
  
  console.log("Current filter values:", { search, tipo, fromDate, toDate })

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    // Only set tipo if it's not 'todos'
    if (tipo && tipo !== 'todos') params.set("tipo", tipo)
    if (fromDate) {
      // Create a date string in YYYY-MM-DD format without timezone conversion
      const year = fromDate.getFullYear();
      const month = String(fromDate.getMonth() + 1).padStart(2, '0');
      const day = String(fromDate.getDate()).padStart(2, '0');
      params.set("from", `${year}-${month}-${day}`);
    }
    if (toDate) {
      // Create a date string in YYYY-MM-DD format without timezone conversion
      const year = toDate.getFullYear();
      const month = String(toDate.getMonth() + 1).padStart(2, '0');
      const day = String(toDate.getDate()).padStart(2, '0');
      params.set("to", `${year}-${month}-${day}`);
    }

    console.log("Applying filters with params:", Object.fromEntries(params.entries()))
    router.push(`/?${params.toString()}`)
  }

  const handleReset = () => {
    setSearch("")
    setTipo("")
    setFromDate(undefined)
    setToDate(undefined)
    router.push("/")
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={tipo || 'todos'} onValueChange={setTipo}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            <SelectItem value="Ingreso">Ingreso</SelectItem>
            <SelectItem value="Gasto">Gasto</SelectItem>
            <SelectItem value="Inversión">Inversión</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {fromDate ? format(fromDate, "dd/MM/yyyy") : "Fecha desde"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus locale={es} />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {toDate ? format(toDate, "dd/MM/yyyy") : "Fecha hasta"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus locale={es} />
          </PopoverContent>
        </Popover>

        <Button onClick={handleSearch}>
          <SearchIcon className="mr-2 h-4 w-4" />
          Buscar
        </Button>

        <Button variant="outline" onClick={handleReset}>
          Limpiar
        </Button>
      </div>
    </div>
  )
}

