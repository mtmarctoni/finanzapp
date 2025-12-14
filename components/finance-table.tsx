"use client"

import { getFinanceEntries } from "@/lib/data"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useSession } from "next-auth/react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Edit, Trash2, Copy, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import Link from "next/link"
import { deleteEntry, deleteManyEntries } from "@/lib/actions"
import { duplicateEntry } from "@/lib/data"
import { useTransition } from "react"
import { useEffect, useState } from "react"
// import { Entry } from "@/lib/definitions"
import { useRouter } from "next/navigation"
import { PaginatedEntriesResponse } from "@/types/api"
import { DEFAULT_ACCION_FILTER, DEFAULT_SORT_BY, DEFAULT_SORT_ORDER, ITEMS_PER_PAGE } from "@/config"

// Using PaginatedEntriesResponse from types/api.ts instead of this interface

export default function FinanceTable({
  searchParams,
}: {
  searchParams?: {
    search?: string
    accion?: string
    from?: string
    to?: string
    page?: string
    itemsPerPage?: string
    sortBy?: string
    sortOrder?: string
  }
}) {
  // Add isPending state for optimistic UI updates
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [entries, setEntries] = useState<PaginatedEntriesResponse>({ data: [], totalItems: 0, totalPages: 0, currentPage: 1 })
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  const search = searchParams?.search || ""
  const accion = searchParams?.accion || DEFAULT_ACCION_FILTER
  const from = searchParams?.from || ""
  const to = searchParams?.to || ""
  const { data: session } = useSession() || ""
  const currentPage = Number(searchParams?.page) || 1
  const itemsPerPage = Number(searchParams?.itemsPerPage) || ITEMS_PER_PAGE
  const [sortBy, setSortBy] = useState<"fecha" | "accion" | "que" | "tipo" | "plataforma_pago" | "cantidad">(searchParams?.sortBy as any || DEFAULT_SORT_BY)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">((searchParams?.sortOrder as any) || DEFAULT_SORT_ORDER)
  
  console.log('FinanceTable received params:', { search, accion, from, to, currentPage, itemsPerPage })

  useEffect(() => {
    const getEntries = async () => {
      console.log('Fetching entries with params:', { search, accion, from, to, page: currentPage, itemsPerPage, sortBy, sortOrder })
      const result = await getFinanceEntries({ search, accion, from, to, page: currentPage, itemsPerPage, sortBy, sortOrder }) as any
      console.log('Received entries:', result)
      setEntries({
        data: result.data ?? [],
        totalItems: (result.totalItems ?? result.total ?? 0) as number,
        totalPages: result.totalPages ?? 0,
        currentPage: result.currentPage ?? currentPage,
      })
    }
    getEntries()
  }, [search, accion, from, to, currentPage, itemsPerPage, sortBy, sortOrder])

  const allSelected = entries.data.length > 0 && selectedIds.length === entries.data.length

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(entries.data.map((e) => e.id))
    }
  }

  const toggleOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleSort = (field: "fecha" | "accion" | "que" | "tipo" | "plataforma_pago" | "cantidad") => {
    const nextOrder = sortBy === field && sortOrder === "desc" ? "asc" : "desc"
    setSortBy(field)
    setSortOrder(nextOrder)
    const params = new URLSearchParams(searchParams as Record<string, string>)
    params.set("sortBy", field)
    params.set("sortOrder", nextOrder)
    router.push(`/records?${params.toString()}`)
  }
  
  return (
    <div className="rounded-md border w-full overflow-x-auto">
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 animate-in fade-in zoom-in-95">
          <div className="text-sm text-muted-foreground">
            {selectedIds.length} seleccionados
          </div>
          <form
            action={(formData) => {
              startTransition(async () => {
                if (!session?.user?.id) {
                  alert('Debes iniciar sesión para eliminar entradas');
                  return;
                }
                await deleteManyEntries(formData, { user: { id: session.user.id } })
                const remaining = entries.data.filter((e) => !selectedIds.includes(e.id))
                setEntries({
                  ...entries,
                  data: remaining,
                  totalItems: Math.max(0, entries.totalItems - selectedIds.length)
                })
                setSelectedIds([])
              })
            }}
          >
            <input type="hidden" name="ids" value={selectedIds.join(",")} />
            <Button
              variant="destructive"
              size="sm"
              type="submit"
              disabled={isPending || selectedIds.length === 0}
              aria-label="Eliminar entradas seleccionadas"
            >
              Eliminar seleccionados
            </Button>
          </form>
        </div>
      )}
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
                aria-label="Seleccionar todas las filas"
              />
            </TableHead>
            <TableHead
              className="w-[100px] group cursor-pointer select-none"
              onClick={() => handleSort("fecha")}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleSort("fecha")}
              role="button"
              tabIndex={0}
              aria-label="Ordenar por fecha"
              aria-sort={sortBy === "fecha" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
            >
              <span className="inline-flex items-center gap-1">
                Fecha
                {sortBy === "fecha" ? (
                  sortOrder === "asc" ? (
                    <ArrowUp className="h-4 w-4 text-primary transition-transform duration-200 group-hover:-translate-y-0.5" />
                  ) : (
                    <ArrowDown className="h-4 w-4 text-primary transition-transform duration-200 group-hover:translate-y-0.5" />
                  )
                ) : (
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground/70 transition-all duration-200 group-hover:text-foreground" />
                )}
              </span>
            </TableHead>
            <TableHead
              className="group cursor-pointer select-none"
              onClick={() => handleSort("accion")}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleSort("accion")}
              role="button"
              tabIndex={0}
              aria-label="Ordenar por acción"
              aria-sort={sortBy === "accion" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
            >
              <span className="inline-flex items-center gap-1">
                Accion
                {sortBy === "accion" ? (
                  sortOrder === "asc" ? (
                    <ArrowUp className="h-4 w-4 text-primary transition-transform duration-200 group-hover:-translate-y-0.5" />
                  ) : (
                    <ArrowDown className="h-4 w-4 text-primary transition-transform duration-200 group-hover:translate-y-0.5" />
                  )
                ) : (
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground/70 transition-all duration-200 group-hover:text-foreground" />
                )}
              </span>
            </TableHead>
            <TableHead
              className="group cursor-pointer select-none"
              onClick={() => handleSort("que")}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleSort("que")}
              role="button"
              tabIndex={0}
              aria-label="Ordenar por qué"
              aria-sort={sortBy === "que" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
            >
              <span className="inline-flex items-center gap-1">
                Qué
                {sortBy === "que" ? (
                  sortOrder === "asc" ? (
                    <ArrowUp className="h-4 w-4 text-primary transition-transform duration-200 group-hover:-translate-y-0.5" />
                  ) : (
                    <ArrowDown className="h-4 w-4 text-primary transition-transform duration-200 group-hover:translate-y-0.5" />
                  )
                ) : (
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground/70 transition-all duration-200 group-hover:text-foreground" />
                )}
              </span>
            </TableHead>
            <TableHead
              className="group cursor-pointer select-none"
              onClick={() => handleSort("tipo")}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleSort("tipo")}
              role="button"
              tabIndex={0}
              aria-label="Ordenar por tipo"
              aria-sort={sortBy === "tipo" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
            >
              <span className="inline-flex items-center gap-1">
                Tipo
                {sortBy === "tipo" ? (
                  sortOrder === "asc" ? (
                    <ArrowUp className="h-4 w-4 text-primary transition-transform duration-200 group-hover:-translate-y-0.5" />
                  ) : (
                    <ArrowDown className="h-4 w-4 text-primary transition-transform duration-200 group-hover:translate-y-0.5" />
                  )
                ) : (
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground/70 transition-all duration-200 group-hover:text-foreground" />
                )}
              </span>
            </TableHead>
            <TableHead
              className="group cursor-pointer select-none"
              onClick={() => handleSort("plataforma_pago")}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleSort("plataforma_pago")}
              role="button"
              tabIndex={0}
              aria-label="Ordenar por plataforma pago"
              aria-sort={sortBy === "plataforma_pago" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
            >
              <span className="inline-flex items-center gap-1">
                Plataforma pago
                {sortBy === "plataforma_pago" ? (
                  sortOrder === "asc" ? (
                    <ArrowUp className="h-4 w-4 text-primary transition-transform duration-200 group-hover:-translate-y-0.5" />
                  ) : (
                    <ArrowDown className="h-4 w-4 text-primary transition-transform duration-200 group-hover:translate-y-0.5" />
                  )
                ) : (
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground/70 transition-all duration-200 group-hover:text-foreground" />
                )}
              </span>
            </TableHead>
            <TableHead
              className="group cursor-pointer select-none"
              onClick={() => handleSort("cantidad")}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleSort("cantidad")}
              role="button"
              tabIndex={0}
              aria-label="Ordenar por cantidad"
              aria-sort={sortBy === "cantidad" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
            >
              <span className="inline-flex items-center gap-1">
                Cantidad
                {sortBy === "cantidad" ? (
                  sortOrder === "asc" ? (
                    <ArrowUp className="h-4 w-4 text-primary transition-transform duration-200 group-hover:-translate-y-0.5" />
                  ) : (
                    <ArrowDown className="h-4 w-4 text-primary transition-transform duration-200 group-hover:translate-y-0.5" />
                  )
                ) : (
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground/70 transition-all duration-200 group-hover:text-foreground" />
                )}
              </span>
            </TableHead>
            <TableHead>Detalle 1</TableHead>
            <TableHead>Detalle 2</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                No hay entradas. Añade una nueva entrada para comenzar.
              </TableCell>
            </TableRow>
          ) : (
            entries.data.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(entry.id)}
                    onCheckedChange={() => toggleOne(entry.id)}
                    aria-label={`Seleccionar fila ${entry.id}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{formatDate(entry.fecha)}</TableCell>
                <TableCell>
                  <span 
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      entry.accion === "Ingreso" 
                        ? "bg-green-100 text-green-800"
                        : entry.accion === "Gasto" 
                          ? "bg-red-100 text-red-800"
                          : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {entry.accion}
                  </span>
                </TableCell>
                <TableCell>{entry.que}</TableCell>
                <TableCell>{entry.tipo}</TableCell>
                <TableCell>{entry.plataforma_pago}</TableCell>
                <TableCell className={entry.accion === 'Gasto' ? 'text-red-500' : entry.accion === 'Ingreso' ? 'text-green-500' : 'text-blue-500'}>
                  {formatCurrency(entry.cantidad)}
                </TableCell>
                <TableCell>{entry.detalle1}</TableCell>
                <TableCell>{entry.detalle2}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Link href={`/edit/${entry.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        title="Editar"
                        aria-label={`Editar entrada ${entry.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      title="Duplicar"
                      disabled={isPending}
                      onClick={async () => {
                        if (!session?.user?.id) {
                          alert('Debes iniciar sesión para duplicar entradas');
                          return;
                        }
                        
                        try {
                          startTransition(async () => {
                            await duplicateEntry(entry.id);
                            // Refresh the entries after successful duplication
                            const result = await getFinanceEntries({ 
                              search, 
                              accion, 
                              from, 
                              to, 
                              page: currentPage, 
                              itemsPerPage,
                              sortBy,
                              sortOrder
                            }) as any;
                            setEntries({
                              data: result.data ?? [],
                              totalItems: (result.totalItems ?? result.total ?? 0) as number,
                              totalPages: result.totalPages ?? 0,
                              currentPage: result.currentPage ?? currentPage,
                            });
                          });
                        } catch (error) {
                          console.error('Error duplicando entrada:', error);
                          alert('Error al duplicar la entrada');
                        }
                      }}
                      aria-label={`Duplicar entrada ${entry.id}`}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <form action={(formData) => {
                      // Optimistic UI update - remove the entry from the local state immediately
                      startTransition(async () => {
                        // Get the current entries
                        const currentEntries = {...entries};
                        // Filter out the deleted entry
                        const updatedData = currentEntries.data.filter(item => item.id !== entry.id);
                        // Update the state with the filtered entries
                        setEntries({
                          ...currentEntries,
                          data: updatedData,
                          totalItems: currentEntries.totalItems - 1
                        });
                        
                        // Then perform the actual deletion
                        if (!session?.user?.id) {
                          throw new Error('User session not available');
                        }
                        await deleteEntry(formData, { user: { id: session.user.id } });
                      });
                    }}>
                      <input type="hidden" name="entryId" value={entry.id} />
                      <Button
                        variant="destructive"
                        size="sm"
                        type="submit"
                        disabled={isPending}
                        aria-label={`Eliminar entrada ${entry.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {entries.totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 py-4">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => {
              const params = new URLSearchParams(searchParams as Record<string, string>)
              params.set('page', '1')
              params.set('itemsPerPage', String(itemsPerPage))
              router.push(`/records?${params.toString()}`)
            }}
            >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => {
              const params = new URLSearchParams(searchParams as Record<string, string>)
              params.set('page', String(currentPage - 1))
              params.set('itemsPerPage', String(itemsPerPage))
              router.push(`/records?${params.toString()}`)
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-sm">
            Página {currentPage} de {entries.totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= entries.totalPages}
            onClick={() => {
              const params = new URLSearchParams(searchParams as Record<string, string>)
              params.set('page', String(currentPage + 1))
              params.set('itemsPerPage', String(itemsPerPage))
              router.push(`/records?${params.toString()}`)
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= entries.totalPages}
            onClick={() => {
              const params = new URLSearchParams(searchParams as Record<string, string>)
              params.set('page', String(entries.totalPages))
              params.set('itemsPerPage', String(itemsPerPage))
              router.push(`/records?${params.toString()}`)
            }}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
