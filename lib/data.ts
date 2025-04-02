require('dotenv').config();
import { createPool, sql } from "@vercel/postgres"
import type { Entry } from "./definitions"

const ITEMS_PER_PAGE = 10

type GetEntriesOptions = {
  search?: string
  tipo?: string
  from?: string
  to?: string
  page?: number
}

const DATABASE_URL = process.env.DATABASE_URL

export async function getFinanceEntries(options: GetEntriesOptions = {}) {
  const { search = "", tipo = "", from = "", to = "", page = 1 } = options
  const offset = (page - 1) * ITEMS_PER_PAGE

  try {
    const pool = createPool({ connectionString: DATABASE_URL })

    try {
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

      // Get total count for pagination
      const countQuery = `SELECT COUNT(*) FROM finance_entries ${whereStatement}`
      // console.log('COUNT QUERY: ', countQuery);
      

      // const countResult = await pool.sql`${countQuery}`
      const countResult = await pool.sql`SELECT COUNT(*) FROM finance_entries`
      const totalItems = Number.parseInt(countResult.rows[0].count)
      const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)

      // Get paginated data
      const dataQuery = `
        SELECT * FROM finance_entries
        ${whereStatement}
        ORDER BY fecha DESC
        LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
      `
      // console.log('DATA QUERY: ', dataQuery);
      

      // const dataResult = await pool.sql`${dataQuery}`
      const dataResult = await pool.sql`SELECT * FROM finance_entries`

      return {
        data: dataResult.rows as Entry[],
        totalItems,
        totalPages,
        currentPage: page,
      }
    } finally {
      await pool.end()
    }
  } catch (error) {
    console.error("Database Error:", error)
    return {
      data: [],
      totalItems: 0,
      totalPages: 0,
      currentPage: page,
    }
  }
}

export async function getEntryById(id: string): Promise<Entry | null> {
  try {
    const pool = createPool({ connectionString: DATABASE_URL })
    // await client.connect()

    try {
      const { rows } = await pool.sql`
        SELECT * FROM finance_entries 
        WHERE id = ${id}
      `
      return rows.length > 0 ? (rows[0] as Entry) : null
    } finally {
      await pool.end()
    }
  } catch (error) {
    console.error("Database Error:", error)
    return null
  }
}

export async function getSummaryStats() {
  try {
    const client = createPool({ connectionString: DATABASE_URL })
    // await client.connect()

    try {
      // Get income stats
      const incomeResult = await client.sql`
        SELECT 
          COALESCE(SUM(cantidad), 0) as total,
          COUNT(*) as count
        FROM finance_entries 
        WHERE tipo = 'Ingreso'
      `

      // Get expense stats
      const expenseResult = await client.sql`
        SELECT 
          COALESCE(SUM(cantidad), 0) as total,
          COUNT(*) as count
        FROM finance_entries 
        WHERE tipo = 'Gasto'
      `

      // Get investment stats
      const investmentResult = await client.sql`
        SELECT 
          COALESCE(SUM(cantidad), 0) as total,
          COUNT(*) as count
        FROM finance_entries 
        WHERE tipo = 'Inversión'
      `

      return {
        totalIncome: Number(incomeResult.rows[0].total) || 0,
        incomeCount: Number(incomeResult.rows[0].count) || 0,
        totalExpense: Number(expenseResult.rows[0].total) || 0,
        expenseCount: Number(expenseResult.rows[0].count) || 0,
        totalInvestment: Number(investmentResult.rows[0].total) || 0,
        investmentCount: Number(investmentResult.rows[0].count) || 0,
        balance: Number(incomeResult.rows[0].total) - Number(expenseResult.rows[0].total) || 0,
      }
    } finally {
      await client.end()
    }
  } catch (error) {
    console.error("Database Error:", error)
    return {
      totalIncome: 0,
      incomeCount: 0,
      totalExpense: 0,
    }
  }
}
