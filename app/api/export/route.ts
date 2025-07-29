import * as XLSX from "xlsx"
import { formatDate } from "@/lib/utils"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getExportEntries } from "@/lib/actions"

const { NEXT_PUBLIC_APP_NAME } = process.env

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const tipo = searchParams.get("tipo") || ""
    const from = searchParams.get("from") || ""
    const to = searchParams.get("to") || ""

    // Get entries with filters from actions
    const entries = await getExportEntries({ search, tipo, from, to }, userId)

    // Format data for Excel
    const data = entries.map((entry) => ({
      "Fecha": formatDate(entry.fecha, true), // Include time information
      "Tipo": entry.tipo,
      "Acción": entry.accion,
      "Qué": entry.que,
      "Plataforma pago": entry.plataformaPago,
      "Cantidad": entry.cantidad,
      "Detalle1": entry.detalle1 || "",
      "Detalle2": entry.detalle2 || "",
    }))

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(data)

    // Add worksheet to workbook with file name the current timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "").replace(/Z/g, "").replace(/-/g, "")
    const fileName = `${timestamp}-${NEXT_PUBLIC_APP_NAME}`
    XLSX.utils.book_append_sheet(workbook, worksheet, "Finanzas")

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

    // Set headers for file download
    return new Response(buffer, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}.xlsx"`,
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

