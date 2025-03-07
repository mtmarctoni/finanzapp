import { createClient } from "@vercel/postgres"
import * as XLSX from "xlsx"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const tipo = searchParams.get("tipo") || ""
    const from = searchParams.get("from") || ""
    const to = searchParams.get("to") || ""

    // Build the WHERE clause based on filters
    const whereClause = []
    const params = []
    let paramIndex = 1

    if (search) {
      whereClause.push(`(
        accion ILIKE $${paramIndex} OR 
        que ILIKE $${paramIndex} OR 
        plataforma_pago ILIKE $${paramIndex} OR
        detalle1 ILIKE $${paramIndex} OR
        detalle2 ILIKE $${paramIndex}
      )`)
      params.push(`%${search}%`)
      paramIndex++
    }

    if (tipo) {
      whereClause.push(`tipo = $${paramIndex}`)
      params.push(tipo)
      paramIndex++
    }

    if (from) {
      whereClause.push(`fecha >= $${paramIndex}`)
      params.push(from)
      paramIndex++
    }

    if (to) {
      whereClause.push(`fecha <= $${paramIndex}`)
      params.push(to)
      paramIndex++
    }

    const whereStatement = whereClause.length > 0 ? `WHERE ${whereClause.join(" AND ")}` : ""

    // Get entries with filters
    const client = createClient()
    await client.connect()

    let entries
    try {
      const query = `
        SELECT * FROM finance_entries 
        ${whereStatement}
        ORDER BY fecha DESC
      `

      const result = await client.query(query, params)
      entries = result.rows
    } finally {
      await client.end()
    }

    // Format data for Excel
    const data = entries.map((entry) => ({
      Fecha: new Date(entry.fecha).toLocaleDateString("es-ES"),
      Tipo: entry.tipo,
      Acción: entry.accion,
      Qué: entry.que,
      "Plataforma pago": entry.plataformaPago,
      Cantidad: entry.cantidad,
      Detalle1: entry.detalle1 || "",
      Detalle2: entry.detalle2 || "",
    }))

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(data)

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Finanzas")

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

    // Set headers for file download
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="finanzas.xlsx"',
      },
    })
  } catch (error) {
    console.error("Export Error:", error)
    return new Response(JSON.stringify({ error: "Failed to export data" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }
}

