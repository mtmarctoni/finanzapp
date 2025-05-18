"use server"

import { createClient, createPool } from "@vercel/postgres"
import { revalidatePath } from "next/cache"
import { v4 as uuidv4 } from "uuid"

interface User {
  id: string
  name: string
  email: string
}

interface EntryFilter {
  search?: string
  accion?: string
  tipo?: string
  from?: string
  to?: string
  page: number
  itemsPerPage: number
}

interface Entry {
  id: string
  fecha: string
  tipo: string
  accion: string
  que: string
  plataforma_pago: string
  cantidad: number
  detalle1?: string
  detalle2?: string
}

interface PaginatedEntries {
  entries: Entry[]
  total: number
  totalPages: number
}

export async function createUser(formData: {
  name: string
  email: string
}) {
  const id = uuidv4()
  try {
    const client = createClient()
    await client.connect()

    try {
      await client.sql`
        INSERT INTO users (id, name, email)
        VALUES (${id}, ${formData.name}, ${formData.email})
      `
    } finally {
      await client.end()
    }
  } catch (error) {
    console.error("Database Error:", error)
    throw new Error("Failed to create user.")
  }

  revalidatePath("/")
}

export async function getUserByEmail(email: string) {
  try {
    const client = createClient()
    await client.connect()

    try {
      const result = await client.sql`
        SELECT id, name, email
        FROM users
        WHERE email = ${email}
      `
      return result.rows[0]
    } finally {
      await client.end()
    }
  } catch (error) {
    console.error("Database Error:", error)
    throw new Error("Failed to get user.")
  }
}

export async function createEntry(formData: {
  fecha: string
  tipo: string
  accion: string
  que: string
  plataforma_pago: string
  cantidad: number
  detalle1?: string
  detalle2?: string
}, session: { user: { id: string } }) {
  const entryId = uuidv4()
  const { fecha, tipo, accion, que, plataforma_pago, cantidad, detalle1, detalle2 } = formData

  try {
    const client = createClient()
    await client.connect()

    try {
      await client.sql`
        INSERT INTO finance_entries (id, fecha, tipo, accion, que, plataforma_pago, cantidad, detalle1, detalle2, user_id)
        VALUES (${entryId}, ${fecha}::timestamptz, ${tipo}, ${accion}, ${que}, ${plataforma_pago}, ${cantidad}, ${detalle1 || null}, ${detalle2 || null}, ${session.user.id})
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
  entryId: string,
  formData: {
    fecha: string
    tipo: string
    accion: string
    que: string
    plataforma_pago: string
    cantidad: number
    detalle1?: string
    detalle2?: string
  },
  session: { user: { id: string } }
) {
  const { fecha, tipo, accion, que, plataforma_pago, cantidad, detalle1, detalle2 } = formData

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
            plataforma_pago = ${plataforma_pago},
            cantidad = ${cantidad},
            detalle1 = ${detalle1 || null},
            detalle2 = ${detalle2 || null},
            updated_at = NOW()
        WHERE id = ${entryId}
          AND user_id = ${session.user.id}
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

export async function deleteEntry(formData: FormData, session: { user: { id: string } }) {
  const client = createClient()
  await client.connect()

  try {
    await client.sql`
      DELETE FROM finance_entries
      WHERE id = ${String(formData.get('entryId'))}
      AND user_id = ${session.user.id}
    `
    revalidatePath("/")
  } finally {
    await client.end()
  }
}

export async function getEntries(filters: EntryFilter, session: { user: { id: string } }): Promise<PaginatedEntries> {
  console.log('Getting entries with filters:', filters);
  const userId = String(session.user.id)
  const { search, accion, tipo, from, to, page, itemsPerPage } = filters
  const offset = (page - 1) * itemsPerPage

  const pool = createPool()

  try {
    console.log('Getting entries with filters:', filters);
    // Build WHERE clause
    const whereClauses: string[] = []
    const params: (string | number)[] = []

    if (search) {
      // Create pattern with wildcards
      const searchPattern = `%${search}%`;
      // We need to use different parameter numbers for each condition
      whereClauses.push(`
        accion ILIKE '${searchPattern}' OR
        que ILIKE '${searchPattern}' OR
        tipo ILIKE '${searchPattern}' OR
        plataforma_pago ILIKE '${searchPattern}' OR
        detalle1 ILIKE '${searchPattern}' OR
        detalle2 ILIKE '${searchPattern}'
      `);
      // Push the pattern for each condition
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (accion && accion !== 'todos') {
      whereClauses.push(`accion = '${accion}'`);
    }

    if (from) {
      // Use local time without Z to prevent timezone offset issues
      whereClauses.push(`fecha >= '${from}T00:00:00.000'::timestamptz`);
    }

    if (to) {
      // Use local time without Z to prevent timezone offset issues
      whereClauses.push(`fecha <= '${to}T23:59:59.999'::timestamptz`);
    }

    // Add user filter
    // console.log('USER ID', userId)
    whereClauses.push(`user_id = '${userId}'`)

    // Build final WHERE clause
    const whereStatment = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
    console.log('Final WHERE clause:', whereStatment);

    // Build the full query with parameters
    const countQuery = `SELECT COUNT(*) FROM finance_entries ${whereStatment}`
    const countResult = await pool.query(countQuery)
    console.log('countResult', countResult)
 
    const total = countResult.rows[0].count;

    // Build the entries query with parameters
    const entriesQuery = `SELECT id, fecha, tipo, accion, que, plataforma_pago, cantidad, detalle1, detalle2, user_id
      FROM finance_entries
      ${whereStatment}
      ORDER BY fecha DESC
      LIMIT ${itemsPerPage}
      OFFSET ${offset}
    `;
    const entriesResult = await pool.query(entriesQuery)
    // console.log('entriesResult', entriesResult)
    const entries = entriesResult.rows as Entry[]
    const totalPages = Math.ceil(total / itemsPerPage)
    // console.log('entries', entries)
    return {
      entries,
      total,
      totalPages
    }
  } finally {
    await pool.end()
  }
}

