import { createPool } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';

const ITEMS_PER_PAGE = 10;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const tipo = searchParams.get('tipo') || '';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const offset = (page - 1) * ITEMS_PER_PAGE;

  try {
    const pool = createPool();

    try {
      // Build the WHERE clause based on filters
      const whereClause = [];
      
      if (search) {
        const searchPattern = `%${search}%`;
        whereClause.push(`(
          accion ILIKE '${searchPattern}' OR 
          que ILIKE '${searchPattern}' OR 
          plataforma_pago ILIKE '${searchPattern}' OR
          detalle1 ILIKE '${searchPattern}' OR
          detalle2 ILIKE '${searchPattern}'
        )`);
      }

      if (tipo) {
        whereClause.push(`tipo = '${tipo}'`);
      }

      if (from) {
        // Use local time without Z to prevent timezone offset issues
        whereClause.push(`fecha >= '${from}T00:00:00.000'::timestamptz`);
      }

      if (to) {
        // Use local time without Z to prevent timezone offset issues
        whereClause.push(`fecha <= '${to}T23:59:59.999'::timestamptz`);
      }
      
      console.log('API filters:', { search, tipo, from, to, whereClause });

      const whereStatement = whereClause.length > 0 ? `WHERE ${whereClause.join(" AND ")}` : "";

      // Get total count for pagination
      const countQuery = `SELECT COUNT(*) FROM finance_entries ${whereStatement}`;
      const countResult = await pool.query(countQuery);
      
      const totalItems = Number.parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

      // Get paginated data
      const dataQuery = `
        SELECT * FROM finance_entries 
        ${whereStatement}
        ORDER BY fecha DESC 
        LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
      `;
      const dataResult = await pool.query(dataQuery);

      return NextResponse.json({
        data: dataResult.rows,
        totalItems,
        totalPages,
        currentPage: page,
      });
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error("Database Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch entries" },
      { status: 500 }
    );
  }
}
