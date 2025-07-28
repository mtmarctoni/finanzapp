"use server"

import { createClient } from "@vercel/postgres"
import { v4 as uuidv4 } from "uuid"

export interface RecurringRecord {
    id: string
    name: string
    accion: string
    tipo: string
    detalle1: string
    detalle2: string
    amount: number
    frequency: string
    active: boolean
    dia: number
    plataforma_pago: string
    user_id: string
}

// Get all recurring records for a user
export async function getRecurringRecords(user_id: string): Promise<RecurringRecord[]> {
    const client = createClient()
    await client.connect()
    try {
        const result = await client.sql`
      SELECT * FROM recurring_records WHERE user_id = ${user_id}
      ORDER BY dia ASC, name ASC
    `
        return result.rows as RecurringRecord[]
    } finally {
        await client.end()
    }
}

// Create a new recurring record
export async function createRecurringRecord(data: Omit<RecurringRecord, "id">): Promise<RecurringRecord> {
    const client = createClient()
    await client.connect()
    const id = uuidv4()
    try {
        await client.sql`
      INSERT INTO recurring_records (
        id, name, accion, tipo, detalle1, detalle2, amount, frequency, active, dia, plataforma_pago, user_id
      ) VALUES (
        ${id}, ${data.name}, ${data.accion}, ${data.tipo}, ${data.detalle1}, ${data.detalle2},
        ${data.amount}, ${data.frequency}, ${data.active}, ${data.dia}, ${data.plataforma_pago}, ${data.user_id}
      )
    `
        return { id, ...data }
    } finally {
        await client.end()
    }
}

// Update an existing recurring record
export async function updateRecurringRecord(
    id: string,
    data: Partial<Omit<RecurringRecord, "id" | "user_id">>,
    user_id: string
): Promise<void> {
    const client = createClient()
    await client.connect()
    try {
        const fields = []
        const values = []
        let idx = 1
        for (const [key, value] of Object.entries(data)) {
            fields.push(`${key} = $${idx}`)
            values.push(value)
            idx++
        }
        if (fields.length === 0) return
        values.push(id, user_id)
        const setClause = fields.join(", ")
        await client.query(
            `UPDATE recurring_records SET ${setClause} WHERE id = $${idx} AND user_id = $${idx + 1}`,
            values
        )

    } finally {
        await client.end()
    }
}

// Delete a recurring record by id and user_id
export async function deleteRecurringRecord(id: string, user_id: string): Promise<boolean> {
    const client = createClient()
    await client.connect()
    try {
        await client.sql`
            DELETE FROM recurring_records WHERE id = ${id} AND user_id = ${user_id}
        `
        return true
    } catch (error) {
        console.error("Error deleting recurring record:", error)
        return false
    } finally {
        await client.end()
    }
}

// Generate finance entries for all active recurring records for a user and a given date, with day logic
export async function generateFinanceEntries(user_id: string, date: string, year: number, month: number): Promise<{ generated: number }> {
    const client = createClient()
    await client.connect()
    try {
        // Get all active recurring records for the user
        const activeRecordsResult = await client.sql<RecurringRecord>`
            SELECT * FROM recurring_records
            WHERE active = true AND user_id = ${user_id}
        `
        // Get all existing entries for the date for the user
        const existingEntries = await client.sql`
            SELECT que FROM finance_entries
            WHERE fecha = ${date} AND user_id = ${user_id}
        `
        // Filter out records that already exist
        const recordsToGenerate = activeRecordsResult.rows.filter(record =>
            !existingEntries.rows.some(entry => entry.que === record.name)
        )
        // Generate new entries for the user
        for (const record of recordsToGenerate) {
            // Ensure date is valid (e.g., 30th of February would be adjusted to 28th)
            const validEntryDate = new Date(year, month - 1, record.dia + 1)
            const validEntryDateStr = validEntryDate.toISOString().split('T')[0]
            await client.sql`
                INSERT INTO finance_entries (
                    id, fecha, tipo, accion, que, cantidad, plataforma_pago, detalle1, detalle2, created_at, updated_at, user_id
                ) VALUES (
                    gen_random_uuid(),
                    ${validEntryDateStr},
                    ${record.tipo},
                    ${record.accion},
                    ${record.name},
                    ${record.amount},
                    ${record.plataforma_pago},
                    ${record.detalle1},
                    ${record.detalle2},
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    ${user_id}
                )
            `
        }
        return { generated: recordsToGenerate.length }
    } finally {
        await client.end()
    }
}
