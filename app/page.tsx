import { Suspense } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PlusCircle } from "lucide-react"
import FinanceTable from "@/components/finance-table"
import { TableSkeleton } from "@/components/table-skeleton"
import Dashboard from "@/components/dashboard"
import { SearchFilter } from "@/components/search-filter"

export default async function Home({
  params,
}: {
  params?: {
    search?: string
    tipo?: string
    from?: string
    to?: string
    page?: string
  }
  }) {
  
  const { search, tipo, from, to, page } = await params || {}
  const searchParams = { search, tipo, from, to, page }
  
  return (
    <main className="container mx-auto py-10 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Finanzas Personales</h1>
        <div className="flex gap-2">
          <Link href="/new">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Añadir Entrada
            </Button>
          </Link>
          <Link href="/api/export" target="_blank">
            <Button variant="outline">Exportar a Excel</Button>
          </Link>
        </div>
      </div>

      <Suspense fallback={<div className="h-[120px] rounded-lg bg-muted animate-pulse" />}>
        <Dashboard />
      </Suspense>

      <div className="mt-8">
        <SearchFilter />
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <FinanceTable searchParams={searchParams} />
      </Suspense>
    </main>
  )
}

