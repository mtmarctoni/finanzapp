"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Combobox } from "@/components/ui/combobox"
import { useEffect, useState } from "react"
import type { CryptoTransaction, CryptoTransactionType } from "@/types/finance"
import { createCryptoTransaction, updateCryptoTransaction, getCryptoOptions } from "@/lib/crypto-data"

const TRANSACTION_TYPES = ["deposit", "withdrawal", "wallet_transfer", "exchange", "staking", "airdrop", "fee", "genesis"] as const

// Helper for optional number fields that properly handles empty strings
const optionalNumber = z.union([
  z.literal("").transform(() => null),
  z.coerce.number(),
]).nullable().optional()

const formSchema = z.object({
  transactionDate: z.string().min(1, "La fecha es requerida"),
  transactionType: z.enum(TRANSACTION_TYPES),
  cryptoSymbol: z.string().min(1, "El símbolo de la cripto es requerido"),
  amount: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  priceAtTransaction: optionalNumber,
  toCryptoSymbol: z.string().optional().nullable(),
  toAmount: optionalNumber,
  fromWallet: z.string().optional().nullable(),
  toWallet: z.string().optional().nullable(),
  fee: z.union([z.literal("").transform(() => 0), z.coerce.number().min(0)]).optional(),
  feeCrypto: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  externalTxId: z.string().optional().nullable(),
})

type CryptoFormValues = z.infer<typeof formSchema>

interface CryptoTransactionFormProps {
  transaction?: CryptoTransaction
}

export function CryptoTransactionForm({ transaction }: CryptoTransactionFormProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [cryptoSymbols, setCryptoSymbols] = useState<string[]>([])
  const [wallets, setWallets] = useState<string[]>([])
  const [transactionTypes, setTransactionTypes] = useState<{ value: string; label: string }[]>([])
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch options on mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const data = await getCryptoOptions()
        setCryptoSymbols(data.cryptoSymbols || [])
        setWallets(data.wallets || [])
        setTransactionTypes(data.transactionTypes || [])
      } catch (error) {
        console.error('Failed to fetch options:', error)
      } finally {
        setOptionsLoading(false)
      }
    }
    fetchOptions()
  }, [])

  const form = useForm<CryptoFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: transaction
      ? {
          transactionDate: new Date(transaction.transactionDate).toISOString().split('T')[0],
          transactionType: transaction.transactionType,
          cryptoSymbol: transaction.cryptoSymbol || "",
          amount: transaction.amount,
          priceAtTransaction: transaction.priceAtTransaction,
          toCryptoSymbol: transaction.toCryptoSymbol,
          toAmount: transaction.toAmount,
          fromWallet: transaction.fromWallet,
          toWallet: transaction.toWallet,
          fee: transaction.fee || 0,
          feeCrypto: transaction.feeCrypto,
          notes: transaction.notes,
          externalTxId: transaction.externalTxId,
        }
      : {
          transactionDate: new Date().toISOString().split("T")[0],
          transactionType: "deposit" as CryptoTransactionType,
          cryptoSymbol: "",
          amount: 0,
          priceAtTransaction: null,
          toCryptoSymbol: null,
          toAmount: null,
          fromWallet: null,
          toWallet: null,
          fee: 0,
          feeCrypto: null,
          notes: null,
          externalTxId: null,
        },
  })

  const transactionType = form.watch('transactionType')
  const showExchangeFields = transactionType === 'exchange'
  const showWalletFields = ['wallet_transfer', 'exchange', 'deposit', 'withdrawal', 'genesis'].includes(transactionType)
  const showPriceField = ['deposit', 'withdrawal', 'genesis'].includes(transactionType)

  async function onSubmit(values: CryptoFormValues) {
    if (!session?.user?.id) {
      alert("Debes iniciar sesión")
      return
    }

    setIsSubmitting(true)

    try {
      const data = {
        ...values,
        transactionDate: new Date(values.transactionDate).toISOString(),
      }

      if (transaction) {
        await updateCryptoTransaction(transaction.id, data)
      } else {
        await createCryptoTransaction(data)
      }
      
      router.push("/investment/crypto")
      router.refresh()
    } catch (error) {
      console.error('Error saving transaction:', error)
      alert("Error al guardar la transacción")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{transaction ? "Editar Transacción" : "Nueva Transacción Cripto"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date */}
              <FormField
                control={form.control}
                name="transactionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Transaction Type */}
              <FormField
                control={form.control}
                name="transactionType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Transacción</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {transactionTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Crypto Symbol */}
              <FormField
                control={form.control}
                name="cryptoSymbol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Criptomoneda</FormLabel>
                    <FormControl>
                      <Combobox
                        options={cryptoSymbols}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Seleccionar cripto..."
                        loading={optionsLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Amount */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cantidad</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.00000001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Price at Transaction (for deposits/withdrawals) */}
              {showPriceField && (
                <FormField
                  control={form.control}
                  name="priceAtTransaction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio (EUR)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          {...field} 
                          value={field.value ?? ''} 
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Exchange Fields */}
              {showExchangeFields && (
                <>
                  <FormField
                    control={form.control}
                    name="toCryptoSymbol"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cripto destino</FormLabel>
                        <FormControl>
                          <Combobox
                            options={cryptoSymbols}
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            placeholder="Seleccionar cripto destino..."
                            loading={optionsLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="toAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cantidad recibida</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.00000001" 
                            {...field} 
                            value={field.value ?? ''} 
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Wallet Fields */}
              {showWalletFields && (
                <>
                  <FormField
                    control={form.control}
                    name="fromWallet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Desde Wallet</FormLabel>
                        <FormControl>
                          <Combobox
                            options={wallets}
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            placeholder="Seleccionar wallet origen..."
                            loading={optionsLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="toWallet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>A Wallet</FormLabel>
                        <FormControl>
                          <Combobox
                            options={wallets}
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            placeholder="Seleccionar wallet destino..."
                            loading={optionsLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Fee */}
              <FormField
                control={form.control}
                name="fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comisión</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.00000001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Fee Crypto */}
              <FormField
                control={form.control}
                name="feeCrypto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cripto de comisión</FormLabel>
                    <FormControl>
                      <Combobox
                        options={cryptoSymbols}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        placeholder="Seleccionar cripto..."
                        loading={optionsLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* External TX ID */}
              <FormField
                control={form.control}
                name="externalTxId"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>TX ID / Order ID</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} placeholder="ID de transacción blockchain o exchange" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Notas</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value ?? ''} placeholder="Notas adicionales..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : transaction ? "Actualizar" : "Guardar"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
