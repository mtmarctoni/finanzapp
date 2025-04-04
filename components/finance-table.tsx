"use client"

import { getFinanceEntries } from "@/lib/data"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Edit, Trash2 } from "lucide-react"
import Link from "next/link"
import { deleteEntry } from "@/lib/actions"
import { useTransition } from "react"
import { useEffect, useState } from "react"
import { Entry } from "@/lib/definitions"
import { useRouter } from "next/navigation"
import { PaginatedEntriesResponse } from "@/types/api"

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
  }
}) {
  // Add isPending state for optimistic UI updates
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [entries, setEntries] = useState<PaginatedEntriesResponse>({ data: [], totalItems: 0, totalPages: 0, currentPage: 1 })
  
  const search = searchParams?.search || ""
  const accion = searchParams?.accion || "todos"
  const from = searchParams?.from || ""
  const to = searchParams?.to || ""
  const currentPage = Number(searchParams?.page) || 1
  const itemsPerPage = Number(searchParams?.itemsPerPage) || 10
  
  console.log('FinanceTable received params:', { search, accion, from, to, currentPage, itemsPerPage })

  useEffect(() => {
    const getEntries = async () => {
      console.log('Fetching entries with params:', { search, accion, from, to, page: currentPage, itemsPerPage })
      const result = await getFinanceEntries({ search, accion, from, to, page: currentPage, itemsPerPage }) as PaginatedEntriesResponse
      console.log('Received entries:', result)
      setEntries(result)
    }
    getEntries()
  }, [search, accion, from, to, currentPage, itemsPerPage])
  
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Fecha</TableHead>
            <TableHead>Accion</TableHead>
            <TableHead>Qué</TableHead>
            <TableHead>Plataforma pago</TableHead>
            <TableHead>Cantidad</TableHead>
            <TableHead>Detalle 1</TableHead>
            <TableHead>Detalle 2</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                No hay entradas. Añade una nueva entrada para comenzar.
              </TableCell>
            </TableRow>
          ) : (
            entries.data.map((entry) => (
              <TableRow key={entry.id}>
                {/* true = include time */}
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
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
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
                        await deleteEntry(formData);
                      });
                    }}>
                      <input type="hidden" name="id" value={entry.id} />
                      <Button
                        variant="destructive"
                        size="sm"
                        type="submit"
                        disabled={isPending}
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
              router.push(`/?${params.toString()}`)
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
              router.push(`/?${params.toString()}`)
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
              router.push(`/?${params.toString()}`)
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
              router.push(`/?${params.toString()}`)
            }}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
