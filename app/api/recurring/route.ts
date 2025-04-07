'use server'

import { sql } from '@vercel/postgres'
import { RecurringRecord, TransactionType } from '@/types/finance'

export async function GET() {
  try {
    const result = await sql<RecurringRecord>`
      SELECT * FROM recurring_records
      ORDER BY name ASC
    `
    return Response.json(result.rows)
  } catch (error) {
    console.error('Error fetching recurring records:', error)
    return Response.json({ error: 'Failed to fetch recurring records' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { name, accion, tipo, detalle1, detalle2, amount, frequency, active = true, plataforma_pago = 'any', dia = 1 } = await request.json()
    
    if (!name || !amount || !tipo || !frequency || !plataforma_pago || !accion) {
      throw new Error('Todos los campos son requeridos')
    }

    const result = await sql`
      INSERT INTO recurring_records (name, accion, tipo, detalle1, detalle2, amount, frequency, active, plataforma_pago, dia)
      VALUES (${name}, ${accion}, ${tipo}, ${detalle1}, ${detalle2}, ${amount}, ${frequency}, ${active}, ${plataforma_pago}, ${dia})
      RETURNING *
    `
    return Response.json(result.rows[0])
  } catch (error) {
    console.error('Error adding recurring record:', error)
    return Response.json({ error: 'Failed to add recurring record' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { id, name, accion, tipo, detalle1, detalle2, amount, frequency, active, plataforma_pago, dia } = await request.json()
    
    if (!id || !name || !amount || !tipo || !frequency || !plataforma_pago || !accion) {
      throw new Error('Todos los campos son requeridos')
    }

    const result = await sql`
      UPDATE recurring_records
      SET name = ${name},
          accion = ${accion},
          tipo = ${tipo},
          detalle1 = ${detalle1},
          detalle2 = ${detalle2},
          amount = ${amount},
          frequency = ${frequency},
          active = ${active},
          plataforma_pago = ${plataforma_pago},
          dia = ${dia},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `
    
    if (result.rows.length === 0) {
      throw new Error('Recurring record not found')
    }
    
    return Response.json(result.rows[0])
  } catch (error) {
    console.error('Error updating recurring record:', error)
    return Response.json({ error: 'Failed to update recurring record' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    
    if (!id) {
      throw new Error('ID is required')
    }

    const result = await sql`
      DELETE FROM recurring_records
      WHERE id = ${id}
    `
    
    if (result.rowCount === 0) {
      throw new Error('Recurring record not found')
    }
    
    return Response.json({ success: true })
  } catch (error) {
    console.error('Error deleting recurring record:', error)
    return Response.json({ error: 'Failed to delete recurring record' }, { status: 500 })
  }
}

// Add a new route for generating records
export async function generate(request: Request) {
  try {
    // Get the date from the request body or use today
    const { date } = await request.json()
    const targetDate = date ? new Date(date) : new Date()
    const targetDateStr = targetDate.toISOString().split('T')[0]

    // Get all active records
    const result = await sql<RecurringRecord>`
      SELECT * FROM recurring_records
      WHERE active = true
    `

    // Get all existing entries for today
    const existingEntries = await sql`
      SELECT que FROM entries
      WHERE fecha = ${targetDateStr}
    `

    // Filter out records that already exist
    const recordsToGenerate = result.rows.filter(record => 
      !existingEntries.rows.some(entry => entry.que === record.name)
    )

    // Generate new entries
    for (const record of recordsToGenerate) {
      await sql`
        INSERT INTO finance_entries (id, fecha, tipo, accion, que, cantidad, created_at, updated_at)
        VALUES (
          gen_random_uuid(),
          ${targetDateStr},
          ${record.tipo},
          ${record.accion},
          ${record.name},
          ${record.amount},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `
    }
    
    return Response.json({ 
      success: true, 
      message: `Generados ${recordsToGenerate.length} registros`,
      generated: recordsToGenerate.length
    })
  } catch (error) {
    console.error('Error generating recurring records:', error)
    return Response.json({ error: 'Failed to generate recurring records' }, { status: 500 })
  }
}

function getNextDate(lastGenerated: Date | null, frequency: string): Date {
  const today = new Date()
  const nextDate = lastGenerated ? new Date(lastGenerated) : new Date(today)
  
  switch (frequency) {
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7)
      break
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14)
      break
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1)
      break
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + 1)
      break
  }
  
  return nextDate
}
