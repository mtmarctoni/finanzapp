import { Suspense } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PlusCircle, FileDown } from "lucide-react"
import FinanceTable from "@/components/finance-table"
import { TableSkeleton } from "@/components/table-skeleton"
import { SearchFilter } from "@/components/search-filter"
import { DEFAULT_ACCION_FILTER, ITEMS_PER_PAGE } from "@/config"

export const dynamic = "force-dynamic"

export default async function RecordsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    search?: string
    accion?: string
    from?: string
    to?: string
    page?: string
    itemsPerPage?: string
  }>
}) {
  const {
    search = "",
    accion = DEFAULT_ACCION_FILTER,
    from = "",
    to = "",
    page = "1",
    itemsPerPage = String(ITEMS_PER_PAGE),
  } = await searchParams ?? {}

  const filterParams = { search, accion, from, to, page, itemsPerPage }

  const exportParams = new URLSearchParams()
  if (search) exportParams.set("search", search)
  if (from) exportParams.set("from", from)
  if (to) exportParams.set("to", to)
  if (accion && accion !== "todos") exportParams.set("tipo", accion)

  return (
    <main className="container mx-auto py-10 space-y-6">
      <div className="flex flex-wrap justify-between items-center">
        <h1 className="text-3xl font-bold">Registros</h1>
        <div className="flex gap-2">
          <Link href="/new">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Añadir Entrada
            </Button>
          </Link>
          <Link href={`/api/export?${exportParams.toString()}`} target="_blank">
            <Button variant="outline">
              <FileDown className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-2">
        <SearchFilter />
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <FinanceTable searchParams={filterParams} />
      </Suspense>
    </main>
  )
}
