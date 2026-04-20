"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from "next/navigation"
import { createEntry, updateEntry } from "@/lib/actions"
import { useSession } from "next-auth/react"
import { Card, CardContent } from "@/components/ui/card"
import type { Entry } from "@/lib/definitions"
import { shouldSplitTransaction } from "@/lib/utils"
import { Combobox } from "@/components/ui/combobox"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Wand2, DollarSign } from "lucide-react"

const formSchema = z.object({
  fecha: z.string().min(1, { message: "La fecha es requerida" }),
  hora: z.coerce.number().min(0).max(23, { message: "La hora debe estar entre 0 y 23" }),
  minuto: z.coerce.number().min(0).max(59, { message: "El minuto debe estar entre 0 y 59" }),
  tipo: z.string().min(1, { message: "El tipo es requerido" }),
  accion: z.string().min(1, { message: "La acción es requerida" }),
  que: z.string().min(1, { message: "El campo 'Qué' es requerido" }),
  plataforma_pago: z.string().min(1, { message: "La plataforma de pago es requerida" }),
  cantidad: z.coerce.number().min(0.01, { message: "La cantidad debe ser mayor a 0" }),
  detalle1: z.string().optional(),
  detalle2: z.string().optional(),
  quien: z.string().min(1, { message: "El pagador es requerido" }),
})

type FinanceFormValues = z.infer<typeof formSchema>

// Pre-filled data from AI parsing
interface ParsedData {
  fecha?: string
  hora?: number
  minuto?: number
  tipo?: string
  accion?: string
  que?: string
  plataforma_pago?: string
  cantidad?: number
  detalle1?: string
  detalle2?: string
  quien?: string
  ai_text?: string
  ai_provider?: string
  ai_model?: string
  ai_cost?: number
  ai_paid?: boolean
}

interface FinanceFormProps {
  entry?: Entry
  parsedData?: ParsedData
}

export function FinanceForm({ entry, parsedData }: FinanceFormProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [tipoOptions, setTipoOptions] = useState<string[]>([])
  const [queOptions, setQueOptions] = useState<string[]>([])
  const [plataformaOptions, setPlataformaOptions] = useState<string[]>([])
  const [quienOptions, setQuienOptions] = useState<string[]>([])
  const [optionsLoading, setOptionsLoading] = useState(true)

  // Fetch dynamic options on mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await fetch('/api/options')
        if (response.ok) {
          const data = await response.json()
          setTipoOptions(data.tipo)
          setQueOptions(data.que)
          setPlataformaOptions(data.plataforma_pago)
          setQuienOptions(data.quien || ["Yo"])
        }
      } catch (error) {
        console.error('Failed to fetch options:', error)
        // Keep empty arrays on error
      } finally {
        setOptionsLoading(false)
      }
    }

    fetchOptions()
  }, [])

  // Build default values based on entry or parsedData
  const getDefaultValues = (): FinanceFormValues => {
    const now = new Date()
    
    if (entry) {
      // Use the existing date when editing
      return {
        fecha: new Date(entry.fecha).toISOString().split('T')[0],
        hora: new Date(entry.fecha).getHours(),
        minuto: new Date(entry.fecha).getMinutes(),
        tipo: entry.tipo || "",
        accion: entry.accion || "",
        que: entry.que || "",
        plataforma_pago: entry.plataforma_pago || "",
        cantidad: shouldSplitTransaction(entry.plataforma_pago, entry.detalle1, entry.accion) ? entry.cantidad * 2 : entry.cantidad,
        detalle1: entry.detalle1 || "",
        detalle2: entry.detalle2 || "",
        quien: entry.quien || "Yo",
      }
    }
    
    if (parsedData) {
      // Use AI-parsed data
      return {
        fecha: parsedData.fecha || now.toISOString().split("T")[0],
        hora: parsedData.hora ?? now.getHours(),
        minuto: parsedData.minuto ?? now.getMinutes(),
        tipo: parsedData.tipo || "",
        accion: parsedData.accion || "",
        que: parsedData.que || "",
        plataforma_pago: parsedData.plataforma_pago || "",
        cantidad: parsedData.cantidad || 0,
        detalle1: parsedData.detalle1 || "",
        detalle2: parsedData.detalle2 || "",
        quien: parsedData.quien || "Yo",
      }
    }
    
    // Default empty form
    return {
      fecha: now.toISOString().split("T")[0],
      hora: now.getHours(),
      minuto: now.getMinutes(),
      tipo: "",
      accion: "",
      que: "",
      plataforma_pago: "",
      cantidad: 0,
      detalle1: "",
      detalle2: "",
      quien: "Yo",
    }
  }

  const form = useForm<FinanceFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaultValues(),
  })

  // Update form when parsedData changes (in case it arrives after mount)
  useEffect(() => {
    if (parsedData && !entry) {
      const now = new Date()
      form.reset({
        fecha: parsedData.fecha || now.toISOString().split("T")[0],
        hora: parsedData.hora ?? now.getHours(),
        minuto: parsedData.minuto ?? now.getMinutes(),
        tipo: parsedData.tipo || "",
        accion: parsedData.accion || "",
        que: parsedData.que || "",
        plataforma_pago: parsedData.plataforma_pago || "",
        cantidad: parsedData.cantidad || 0,
        detalle1: parsedData.detalle1 || "",
        detalle2: parsedData.detalle2 || "",
        quien: parsedData.quien || "Yo",
      })
    }
  }, [parsedData, entry, form])

  const plataformaPago = form.watch('plataforma_pago')
  const detalle1 = form.watch('detalle1')

  async function onSubmit(values: z.infer<typeof formSchema>) {
    // Combine date and time into a single ISO string
    const dateWithTime = new Date(values.fecha);
    dateWithTime.setHours(values.hora, values.minuto);

    // Create a new object without hora and minuto properties
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hora, minuto, ...otherValues } = values;
    const formattedValues = {
      ...otherValues,
      fecha: dateWithTime.toISOString()
    };

    // For joyntlanda transactions, the entered cantidad is the total, so save half as my part
    if (shouldSplitTransaction(formattedValues.plataforma_pago, formattedValues.detalle1, formattedValues.accion)) {
      formattedValues.cantidad /= 2;
    }

    console.log('FECHA:', formattedValues.fecha)

    if (!session?.user?.id) {
      throw new Error("User not authenticated")
    }

    if (entry) {
      await updateEntry(entry.id, formattedValues, { user: { id: session.user.id } })
    } else {
      await createEntry(formattedValues, { user: { id: session.user.id } })
    }
    router.push("/")
    router.refresh()
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {/* AI Parse Info Banner */}
        {parsedData && parsedData.ai_text && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Wand2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-blue-900 dark:text-blue-100">
                Datos extraídos por IA
              </span>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
              Texto original: &ldquo;{parsedData.ai_text}&rdquo;
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {parsedData.ai_provider} / {parsedData.ai_model}
              </Badge>
              {parsedData.ai_paid && (
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Cost: ${parsedData.ai_cost?.toFixed(4) || "0.0000"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              Revisa y confirma los datos antes de guardar
            </p>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="fecha"
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

              <div className="flex space-x-2">
                <FormField
                  control={form.control}
                  name="hora"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Hora</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" max="23" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minuto"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Minuto</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" max="59" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="accion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Acción</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Ingreso">Ingreso</SelectItem>
                        <SelectItem value="Gasto">Gasto</SelectItem>
                        <SelectItem value="Inversión">Inversión</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <FormControl>
                      <Combobox
                        options={tipoOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Seleccionar tipo..."
                        loading={optionsLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="que"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Qué</FormLabel>
                    <FormControl>
                      <Combobox
                        options={queOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Seleccionar qué..."
                        loading={optionsLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="plataforma_pago"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plataforma de pago</FormLabel>
                    <FormControl>
                      <Combobox
                        options={plataformaOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Seleccionar plataforma..."
                        loading={optionsLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cantidad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{shouldSplitTransaction(plataformaPago, detalle1, form.watch('accion')) ? 'Total Amount' : 'Cantidad'}</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="detalle1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Detalle 1</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="detalle2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Detalle 2</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quien"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quién</FormLabel>
                    <FormControl>
                      <Combobox
                        options={quienOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Seleccionar quién pagó..."
                        loading={optionsLoading}
                      />
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
              <Button type="submit">{entry ? "Actualizar" : "Guardar"}</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
