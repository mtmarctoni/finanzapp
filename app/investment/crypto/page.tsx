import { Suspense } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import CryptoTransactionTable from "@/components/crypto/crypto-transaction-table"
import { CryptoSearchFilter } from "@/components/crypto/crypto-search-filter"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = {
  title: "Transacciones Cripto | FinanzApp",
  description: "Gestiona tus transacciones de criptomonedas",
}

interface CryptoPageProps {
  searchParams: Promise<{
    search?: string
    transactionType?: string
    cryptoSymbol?: string
    from?: string
    to?: string
    page?: string
    itemsPerPage?: string
    sortBy?: string
    sortOrder?: string
  }>
}

export default async function CryptoPage({ searchParams }: CryptoPageProps) {
  const params = await searchParams

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transacciones Cripto</h1>
          <p className="text-muted-foreground">
            Gestiona tus transacciones de criptomonedas, intercambios y movimientos entre wallets.
          </p>
        </div>
        <Button asChild>
          <Link href="/investment/crypto/new">
            <Plus className="mr-2 h-4 w-4" />
            Nueva Transacción
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Suspense fallback={<Skeleton className="h-20 w-full" />}>
        <CryptoSearchFilter />
      </Suspense>

      {/* Transactions Table */}
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CryptoTransactionTable searchParams={params} />
      </Suspense>
    </div>
  )
}
