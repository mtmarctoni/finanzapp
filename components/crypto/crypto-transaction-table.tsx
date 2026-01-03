"use client"

import { formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useSession } from "next-auth/react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import Link from "next/link"
import { useTransition, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getCryptoTransactions, deleteCryptoTransaction } from "@/lib/crypto-data"
import type { CryptoTransaction } from "@/types/finance"
import { Badge } from "@/components/ui/badge"
import { ITEMS_PER_PAGE } from "@/config"

interface CryptoTransactionsResponse {
  data: CryptoTransaction[]
  total: number
  totalPages: number
  currentPage: number
}

const TRANSACTION_TYPE_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  deposit: { label: "Depósito", variant: "default" },
  withdrawal: { label: "Retiro", variant: "destructive" },
  wallet_transfer: { label: "Transferencia", variant: "secondary" },
  exchange: { label: "Intercambio", variant: "outline" },
  staking: { label: "Staking", variant: "default" },
  airdrop: { label: "Airdrop", variant: "default" },
  fee: { label: "Comisión", variant: "destructive" },
}

export default function CryptoTransactionTable({
  searchParams,
}: {
  searchParams?: {
    search?: string
    transactionType?: string
    cryptoSymbol?: string
    from?: string
    to?: string
    page?: string
    itemsPerPage?: string
    sortBy?: string
    sortOrder?: string
  }
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [transactions, setTransactions] = useState<CryptoTransactionsResponse>({
    data: [],
    total: 0,
    totalPages: 0,
    currentPage: 1,
  })
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  const search = searchParams?.search || ""
  const transactionType = searchParams?.transactionType || "all"
  const cryptoSymbol = searchParams?.cryptoSymbol || ""
  const from = searchParams?.from || ""
  const to = searchParams?.to || ""
  const { data: session } = useSession()
  const currentPage = Number(searchParams?.page) || 1
  const itemsPerPage = Number(searchParams?.itemsPerPage) || ITEMS_PER_PAGE
  const [sortBy, setSortBy] = useState<"transaction_date" | "crypto_symbol" | "amount" | "transaction_type">(
    (searchParams?.sortBy as any) || "transaction_date"
  )
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">((searchParams?.sortOrder as any) || "desc")

  useEffect(() => {
    const fetchTransactions = async () => {
      const result = await getCryptoTransactions({
        search,
        transactionType,
        cryptoSymbol,
        from,
        to,
        page: currentPage,
        itemsPerPage,
        sortBy,
        sortOrder,
      })
      setTransactions({
        data: result.data ?? [],
        total: result.total ?? 0,
        totalPages: result.totalPages ?? 0,
        currentPage: result.currentPage ?? currentPage,
      })
    }
    fetchTransactions()
  }, [search, transactionType, cryptoSymbol, from, to, currentPage, itemsPerPage, sortBy, sortOrder])

  const allSelected = transactions.data.length > 0 && selectedIds.length === transactions.data.length

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(transactions.data.map((t) => t.id))
    }
  }

  const toggleOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleSort = (field: "transaction_date" | "crypto_symbol" | "amount" | "transaction_type") => {
    const nextOrder = sortBy === field && sortOrder === "desc" ? "asc" : "desc"
    setSortBy(field)
    setSortOrder(nextOrder)
    const params = new URLSearchParams(searchParams as Record<string, string>)
    params.set("sortBy", field)
    params.set("sortOrder", nextOrder)
    router.push(`/investment/crypto?${params.toString()}`)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta transacción?")) return
    
    startTransition(async () => {
      const success = await deleteCryptoTransaction(id)
      if (success) {
        setTransactions((prev) => ({
          ...prev,
          data: prev.data.filter((t) => t.id !== id),
          total: Math.max(0, prev.total - 1),
        }))
      }
    })
  }

  const handleDeleteMany = async () => {
    if (!confirm(`¿Estás seguro de eliminar ${selectedIds.length} transacciones?`)) return
    
    startTransition(async () => {
      let deletedCount = 0
      for (const id of selectedIds) {
        const success = await deleteCryptoTransaction(id)
        if (success) deletedCount++
      }
      
      setTransactions((prev) => ({
        ...prev,
        data: prev.data.filter((t) => !selectedIds.includes(t.id)),
        total: Math.max(0, prev.total - deletedCount),
      }))
      setSelectedIds([])
    })
  }

  const totalPages = transactions.totalPages
  
  const createPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams as Record<string, string>)
    params.set("page", page.toString())
    return `/investment/crypto?${params.toString()}`
  }

  const formatCryptoAmount = (amount: number, symbol: string) => {
    return `${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 8 })} ${symbol}`
  }

  return (
    <div className="rounded-md border w-full overflow-x-auto">
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 animate-in fade-in zoom-in-95">
          <div className="text-sm text-muted-foreground">
            {selectedIds.length} seleccionados
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteMany}
            disabled={isPending || selectedIds.length === 0}
            aria-label="Eliminar transacciones seleccionadas"
          >
            Eliminar seleccionados
          </Button>
        </div>
      )}
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
                aria-label="Seleccionar todas las filas"
              />
            </TableHead>
            <TableHead
              className="w-25 group cursor-pointer select-none"
              onClick={() => handleSort("transaction_date")}
              role="columnheader"
              tabIndex={0}
            >
              <span className="inline-flex items-center gap-1">
                Fecha
                {sortBy === "transaction_date" ? (
                  sortOrder === "asc" ? (
                    <ArrowUp className="h-4 w-4 text-primary" />
                  ) : (
                    <ArrowDown className="h-4 w-4 text-primary" />
                  )
                ) : (
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground/70" />
                )}
              </span>
            </TableHead>
            <TableHead
              className="group cursor-pointer select-none"
              onClick={() => handleSort("transaction_type")}
              role="columnheader"
              tabIndex={0}
            >
              <span className="inline-flex items-center gap-1">
                Tipo
                {sortBy === "transaction_type" ? (
                  sortOrder === "asc" ? (
                    <ArrowUp className="h-4 w-4 text-primary" />
                  ) : (
                    <ArrowDown className="h-4 w-4 text-primary" />
                  )
                ) : (
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground/70" />
                )}
              </span>
            </TableHead>
            <TableHead
              className="group cursor-pointer select-none"
              onClick={() => handleSort("crypto_symbol")}
              role="columnheader"
              tabIndex={0}
            >
              <span className="inline-flex items-center gap-1">
                Cripto
                {sortBy === "crypto_symbol" ? (
                  sortOrder === "asc" ? (
                    <ArrowUp className="h-4 w-4 text-primary" />
                  ) : (
                    <ArrowDown className="h-4 w-4 text-primary" />
                  )
                ) : (
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground/70" />
                )}
              </span>
            </TableHead>
            <TableHead
              className="group cursor-pointer select-none text-right"
              onClick={() => handleSort("amount")}
              role="columnheader"
              tabIndex={0}
            >
              <span className="inline-flex items-center gap-1 justify-end">
                Cantidad
                {sortBy === "amount" ? (
                  sortOrder === "asc" ? (
                    <ArrowUp className="h-4 w-4 text-primary" />
                  ) : (
                    <ArrowDown className="h-4 w-4 text-primary" />
                  )
                ) : (
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground/70" />
                )}
              </span>
            </TableHead>
            <TableHead>Desde</TableHead>
            <TableHead>Hacia</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="w-[100px]">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center">
                No hay transacciones
              </TableCell>
            </TableRow>
          ) : (
            transactions.data.map((transaction) => {
              const typeInfo = TRANSACTION_TYPE_LABELS[transaction.transactionType] || {
                label: transaction.transactionType,
                variant: "outline" as const,
              }
              
              return (
                <TableRow
                  key={transaction.id}
                  data-state={selectedIds.includes(transaction.id) ? "selected" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(transaction.id)}
                      onCheckedChange={() => toggleOne(transaction.id)}
                      aria-label={`Seleccionar transacción ${transaction.id}`}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(transaction.transactionDate)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {transaction.cryptoSymbol}
                    {transaction.transactionType === "exchange" && transaction.toCryptoSymbol && (
                      <span className="text-muted-foreground"> → {transaction.toCryptoSymbol}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCryptoAmount(transaction.amount, transaction.cryptoSymbol)}
                    {transaction.transactionType === "exchange" && transaction.toAmount && (
                      <div className="text-sm text-muted-foreground">
                        → {formatCryptoAmount(transaction.toAmount, transaction.toCryptoSymbol || '')}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {transaction.fromWallet || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {transaction.toWallet || "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {transaction.priceAtTransaction
                      ? `€${transaction.priceAtTransaction.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/investment/crypto/edit/${transaction.id}`}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Editar</span>
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(transaction.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Eliminar</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="text-sm text-muted-foreground">
            Mostrando {(currentPage - 1) * itemsPerPage + 1} a{" "}
            {Math.min(currentPage * itemsPerPage, transactions.total)} de {transactions.total}
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" asChild disabled={currentPage <= 1}>
              <Link href={createPageUrl(1)}>
                <ChevronsLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="icon" asChild disabled={currentPage <= 1}>
              <Link href={createPageUrl(currentPage - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
            <span className="flex items-center px-3 text-sm">
              {currentPage} / {totalPages}
            </span>
            <Button variant="outline" size="icon" asChild disabled={currentPage >= totalPages}>
              <Link href={createPageUrl(currentPage + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="icon" asChild disabled={currentPage >= totalPages}>
              <Link href={createPageUrl(totalPages)}>
                <ChevronsRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
