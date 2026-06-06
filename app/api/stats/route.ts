import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getPool } from '@/lib/db';

/**
 * GET /api/stats
 *
 * SECURITY: This route previously required no authentication and ran
 * un-scoped aggregations across the entire `finance_entries` table —
 * effectively leaking every user's totals to anyone who could reach the
 * endpoint. It also filtered on `tipo` instead of `accion`, which never
 * matched the schema. The route now requires a session and is scoped to
 * the authenticated user's rows via parameterized queries.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const pool = getPool();
  try {
    const [incomeResult, expenseResult, investmentResult] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(cantidad), 0) AS total, COUNT(*) AS count
           FROM finance_entries
          WHERE accion = 'Ingreso' AND user_id = $1`,
        [userId],
      ),
      pool.query(
        `SELECT COALESCE(SUM(cantidad), 0) AS total, COUNT(*) AS count
           FROM finance_entries
          WHERE accion = 'Gasto' AND user_id = $1`,
        [userId],
      ),
      pool.query(
        `SELECT COALESCE(SUM(cantidad), 0) AS total, COUNT(*) AS count
           FROM finance_entries
          WHERE accion = 'Inversión' AND user_id = $1`,
        [userId],
      ),
    ]);

    const totalIncome = Number(incomeResult.rows[0].total) || 0;
    const totalExpense = Number(expenseResult.rows[0].total) || 0;

    return NextResponse.json({
      totalIncome,
      incomeCount: Number(incomeResult.rows[0].count) || 0,
      totalExpense,
      expenseCount: Number(expenseResult.rows[0].count) || 0,
      totalInvestment: Number(investmentResult.rows[0].total) || 0,
      investmentCount: Number(investmentResult.rows[0].count) || 0,
      balance: totalIncome - totalExpense,
    });
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 },
    );
  }
}
