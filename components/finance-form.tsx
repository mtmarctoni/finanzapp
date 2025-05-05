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
import { Card, CardContent } from "@/components/ui/card"
import type { Entry } from "@/lib/definitions"

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
})

export function FinanceForm({ entry }: { entry?: Entry }) {
  const router = useRouter()
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: entry
      ? {
          // Use the existing date when editing
          fecha: new Date(entry.fecha).toISOString().split('T')[0],
          hora: new Date(entry.fecha).getHours(),
          minuto: new Date(entry.fecha).getMinutes(),
          tipo: entry.tipo || "",
          accion: entry.accion || "",
          que: entry.que || "",
          plataforma_pago: entry.plataforma_pago || "",
          cantidad: entry.cantidad || 0,
          detalle1: entry.detalle1 || "",
          detalle2: entry.detalle2 || "",
        }
      : {
          fecha: new Date().toISOString().split("T")[0],
          hora: new Date().getHours(),
          minuto: new Date().getMinutes(),
          tipo: "",
          accion: "",
          que: "",
          plataforma_pago: "",
          cantidad: 0,
          detalle1: "",
          detalle2: "",
        },
  })

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
    console.log('FECHA:', formattedValues.fecha)
    
    if (entry) {
      await updateEntry(entry.id, formattedValues)
    } else {
      await createEntry(formattedValues)
    }
    router.push("/")
    router.refresh()
  }

  return (
    <Card>
      <CardContent className="pt-6">
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
                      <Input {...field} />
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
                      <Input {...field} />
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
                      <Input {...field} />
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
                    <FormLabel>Cantidad</FormLabel>
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

