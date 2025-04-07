'use server'

import { sql } from '@vercel/postgres'
import { RecurringRecord, TransactionType } from '@/types/finance'

interface GenerateError {
  error: string
  details?: string
}

export async function POST(request: Request) {
  try {
    console.log('Starting generate request')
    
    // Get the date from the request body or use today
    const { date } = await request.json()
    console.log('Received date:', date)
    
    if (!date) {
      throw new Error('No date provided')
    }

    const targetDate = new Date(date)
    const targetYear = targetDate.getFullYear()
    // Convert from 0-based to 1-based month (1 for January, 2 for February, etc.)
    const targetMonth = targetDate.getMonth() + 1
    
    console.log('Target year:', targetYear, 'Target month:', targetMonth)

    // Get all active records
    console.log('Fetching active records')
    const result = await sql<RecurringRecord>`
      SELECT * FROM recurring_records
      WHERE active = true
    `
    console.log('Found active records:', result.rows.length)

    // Get all existing entries for the target date
    console.log('Checking existing entries')
    const existingEntries = await sql`
      SELECT que FROM finance_entries
      WHERE fecha = ${date}
    `
    console.log('Existing entries:', existingEntries.rows.length)

    // Filter out records that already exist
    const recordsToGenerate = result.rows.filter(record => 
      !existingEntries.rows.some(entry => entry.que === record.name)
    )
    console.log('Records to generate:', recordsToGenerate.length)

    // Generate new entries
    for (const record of recordsToGenerate) {
      console.log('Generating record:', record.name)
      // Ensure date is valid (e.g., 30th of February would be adjusted to 28th)
      // We need to create a new date object to avoid modifying the original entryDate
      // Do not know why the Date method substract 1 to the day parameter, we need to add 1 to fix it
      const validEntryDate = new Date(targetYear, targetMonth - 1, record.dia + 1)
      const validEntryDateStr = validEntryDate.toISOString().split('T')[0]
      
      console.log('Generating record on date:', validEntryDateStr)
      
      await sql`
        INSERT INTO finance_entries (id, fecha, tipo, accion, que, cantidad, plataforma_pago, detalle1, detalle2, created_at, updated_at)
        VALUES (
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
          CURRENT_TIMESTAMP
        )
      `
      console.log('Successfully generated record:', record.name)
    }
    
    return Response.json({ 
      success: true, 
      message: `Generados ${recordsToGenerate.length} registros`,
      generated: recordsToGenerate.length
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Detailed error:', {
      error,
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    })
    
    return Response.json({ 
      error: 'Failed to generate recurring records',
      details: errorMessage
    }, { status: 500 })
  }
}
