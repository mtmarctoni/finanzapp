"use client"

import { getFinanceEntries } from "@/lib/data"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Edit, Trash2 } from "lucide-react"
import Link from "next/link"
import { deleteEntry } from "@/lib/actions"

export default async function FinanceTable({
  searchParams,
}: {
  searchParams?: {
    search?: string
    tipo?: string
    from?: string
    to?: string
    page?: string
  }
}) {
  const search = searchParams?.search || ""
  const tipo = searchParams?.tipo || ""
  const from = searchParams?.from || ""
  const to = searchParams?.to || ""
  const currentPage = Number(searchParams?.page) || 1

  const entries = await getFinanceEntries({ search, tipo, from, to, page: currentPage })

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Acción</TableHead>
            <TableHead>Qué</TableHead>
            <TableHead>Plataforma pago</TableHead>
            <TableHead>Cantidad</TableHead>
            <TableHead>Detalle1</TableHead>
            <TableHead>Detalle2</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
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
                <TableCell>{formatDate(entry.fecha)}</TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      entry.tipo === "Ingreso"
                        ? "bg-green-100 text-green-800"
                        : entry.tipo === "Gasto"
                          ? "bg-red-100 text-red-800"
                          : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {entry.tipo}
                  </span>
                </TableCell>
                <TableCell>{entry.accion}</TableCell>
                <TableCell>{entry.que}</TableCell>
                <TableCell>{entry.plataformaPago}</TableCell>
                <TableCell>{formatCurrency(entry.cantidad)}</TableCell>
                <TableCell>{entry.detalle1}</TableCell>
                <TableCell>{entry.detalle2}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Link href={`/edit/${entry.id}`}>
                      <Button size="icon" variant="ghost">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                    <form action={deleteEntry}>
                      <input type="hidden" name="id" value={entry.id} />
                      <Button size="icon" variant="ghost" type="submit">
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
              const params = new URLSearchParams(searchParams)
              params.set("page", String(currentPage - 1))
              window.location.href = `/?${params.toString()}`
            }}
          >
            Anterior
          </Button>
          <span className="text-sm">
            Página {currentPage} de {entries.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= entries.totalPages}
            onClick={() => {
              const params = new URLSearchParams(searchParams)
              params.set("page", String(currentPage + 1))
              window.location.href = `/?${params.toString()}`
            }}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  )
}

