"use client"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Search, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { getCryptoOptions } from "@/lib/crypto-data"

export function CryptoSearchFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [transactionType, setTransactionType] = useState(searchParams.get("transactionType") || "all")
  const [cryptoSymbol, setCryptoSymbol] = useState(searchParams.get("cryptoSymbol") || "")
  const [from, setFrom] = useState(searchParams.get("from") || "")
  const [to, setTo] = useState(searchParams.get("to") || "")
  
  const [cryptoSymbols, setCryptoSymbols] = useState<string[]>([])
  const [transactionTypes, setTransactionTypes] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    const fetchOptions = async () => {
      const options = await getCryptoOptions()
      setCryptoSymbols(options.cryptoSymbols || [])
      setTransactionTypes(options.transactionTypes || [])
    }
    fetchOptions()
  }, [])

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (transactionType && transactionType !== "all") params.set("transactionType", transactionType)
    if (cryptoSymbol) params.set("cryptoSymbol", cryptoSymbol)
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    params.set("page", "1")
    router.push(`/investment/crypto?${params.toString()}`)
  }

  const clearFilters = () => {
    setSearch("")
    setTransactionType("all")
    setCryptoSymbol("")
    setFrom("")
    setTo("")
    router.push("/investment/crypto")
  }

  const hasFilters = search || (transactionType && transactionType !== "all") || cryptoSymbol || from || to

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end">
      {/* Search */}
      <div className="flex-1">
        <label className="text-sm font-medium mb-1 block">Buscar</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar en notas, wallets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="pl-9"
          />
        </div>
      </div>

      {/* Transaction Type */}
      <div className="w-full md:w-[180px]">
        <label className="text-sm font-medium mb-1 block">Tipo</label>
        <Select value={transactionType} onValueChange={setTransactionType}>
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {transactionTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
            <SelectItem value="genesis">Génesis (Origen)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Crypto Symbol */}
      <div className="w-full md:w-[140px]">
        <label className="text-sm font-medium mb-1 block">Cripto</label>
        <Select value={cryptoSymbol} onValueChange={setCryptoSymbol}>
          <SelectTrigger>
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {cryptoSymbols.slice(0, 20).map((symbol) => (
              <SelectItem key={symbol} value={symbol}>
                {symbol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date From */}
      <div className="w-full md:w-[150px]">
        <label className="text-sm font-medium mb-1 block">Desde</label>
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </div>

      {/* Date To */}
      <div className="w-full md:w-[150px]">
        <label className="text-sm font-medium mb-1 block">Hasta</label>
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={applyFilters}>Filtrar</Button>
        {hasFilters && (
          <Button variant="outline" size="icon" onClick={clearFilters}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
