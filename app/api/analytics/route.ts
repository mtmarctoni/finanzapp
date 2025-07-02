// app/api/analytics/route.ts
import { createPool } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Get all possible filter parameters
  const search = searchParams.get('search');
  const action = searchParams.get('action') || 'todos';
  const fromDate = searchParams.get('from');
  const toDate = searchParams.get('to');

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  try {
    const pool = createPool();

    try {
      // Build WHERE clause
      const whereClauses: string[] = [`user_id = '${session.user.id}'`];
      const queryParams: any[] = [];
      let paramIndex = 1;
      
      if (search) {
        const searchTerm = `%${search.toLowerCase()}%`;
        whereClauses.push(`(
          LOWER(tipo) LIKE $${paramIndex} OR 
          LOWER(que) LIKE $${paramIndex} OR 
          LOWER(plataforma_pago) LIKE $${paramIndex} OR
          LOWER(COALESCE(detalle1, '')) LIKE $${paramIndex} OR
          LOWER(COALESCE(detalle2, '')) LIKE $${paramIndex}
        )`);
        queryParams.push(searchTerm);
        paramIndex++;
      }
      
      if (action && action !== 'todos') {
        whereClauses.push(`accion = $${paramIndex}`);
        queryParams.push(action);
        paramIndex++;
      }
      
      if (fromDate) {
        whereClauses.push(`fecha >= $${paramIndex}`);
        queryParams.push(fromDate);
        paramIndex++;
      }
      
      if (toDate) {
        whereClauses.push(`fecha <= $${paramIndex}::date + INTERVAL '1 day - 1 second'`);
        queryParams.push(toDate);
        paramIndex++;
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Get data for temporal chart (grouped by month and action)
      const temporalData = await pool.query(
        `SELECT 
          date_trunc('month', fecha) as month,
          accion as action,
          SUM(cantidad) as total
        FROM finance_entries
        ${whereClause}
        GROUP BY date_trunc('month', fecha), accion
        ORDER BY month, accion`,
        queryParams
      );

      // Get data for category breakdown
      const categoryData = await pool.query(
        `SELECT 
          que as category,
          accion as action,
          SUM(cantidad) as total
        FROM finance_entries
        ${whereClause}
        GROUP BY que, accion
        HAVING SUM(cantidad) != 0
        ORDER BY total DESC`,
        queryParams
      );

      // Calculate sums for each action type
      const actionSums = await pool.query(
        `SELECT 
          accion as action,
          SUM(cantidad) as total
        FROM finance_entries
        ${whereClause}
        GROUP BY accion
        HAVING SUM(cantidad) != 0`,
        queryParams
      );

      // Convert to a more usable format
      const sums = actionSums.rows.reduce((acc, row) => {
        acc[row.action] = row.total;
        return acc;
      }, {} as Record<string, number>);

      return NextResponse.json({
        temporalData: temporalData.rows,
        categoryData: categoryData.rows,
        sums: {
          gastos: Math.abs(sums['Gasto'] || 0),
          ingresos: Math.abs(sums['Ingreso'] || 0),
          inversion: Math.abs(sums['Inversión'] || 0),
        },
      });
    } catch (error) {
      console.error('Database query error:', error);
      return NextResponse.json(
        { error: 'Error querying database' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Database connection error:', error);
    return NextResponse.json(
      { error: 'Error connecting to database' },
      { status: 500 }
    );
  }
}