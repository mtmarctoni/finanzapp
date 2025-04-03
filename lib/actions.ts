"use server"

import { createClient } from "@vercel/postgres"
import { revalidatePath } from "next/cache"
import { v4 as uuidv4 } from "uuid"

export async function createEntry(formData: {
  fecha: string
  tipo: string
  accion: string
  que: string
  plataformaPago: string
  cantidad: number
  detalle1?: string
  detalle2?: string
}) {
  const id = uuidv4()
  const { fecha, tipo, accion, que, plataformaPago, cantidad, detalle1, detalle2 } = formData

  try {
    const client = createClient()
    await client.connect()

    try {
      await client.sql`
        INSERT INTO finance_entries (id, fecha, tipo, accion, que, plataforma_pago, cantidad, detalle1, detalle2)
        VALUES (${id}, ${fecha}::timestamptz, ${tipo}, ${accion}, ${que}, ${plataformaPago}, ${cantidad}, ${detalle1 || null}, ${detalle2 || null})
      `
    } finally {
      await client.end()
    }
  } catch (error) {
    console.error("Database Error:", error)
    throw new Error("Failed to create entry.")
  }

  revalidatePath("/")
}

export async function updateEntry(
  id: string,
  formData: {
    fecha: string
    tipo: string
    accion: string
    que: string
    plataformaPago: string
    cantidad: number
    detalle1?: string
    detalle2?: string
  },
) {
  const { fecha, tipo, accion, que, plataformaPago, cantidad, detalle1, detalle2 } = formData

  try {
    const client = createClient()
    await client.connect()

    try {
      await client.sql`
        UPDATE finance_entries
        SET fecha = ${fecha}::timestamptz,
            tipo = ${tipo},
            accion = ${accion},
            que = ${que},
            plataforma_pago = ${plataformaPago},
            cantidad = ${cantidad},
            detalle1 = ${detalle1 || null},
            detalle2 = ${detalle2 || null},
            updated_at = NOW()
        WHERE id = ${id}
      `
    } finally {
      await client.end()
    }
  } catch (error) {
    console.error("Database Error:", error)
    throw new Error("Failed to update entry.")
  }

  revalidatePath("/")
}

export async function deleteEntry(formData: FormData) {
  const id = formData.get("id") as string

  try {
    const client = createClient()
    await client.connect()

    try {
      await client.sql`
        DELETE FROM finance_entries
        WHERE id = ${id}
      `
    } finally {
      await client.end()
    }
  } catch (error) {
    console.error("Database Error:", error)
    throw new Error("Failed to delete entry.")
  }

  revalidatePath("/")
}

