import { type Session } from 'next-auth';

import type { Entry } from './definitions';

import { getPool } from '@/lib/db';

/**
 * Server-side function to get summary statistics
 * This is used by server components.
 *
 * SECURITY: this function previously interpolated `month` and
 * `session.user.id` directly into SQL strings, which was a classic
 * SQL-injection vector. All user-controlled values are now bound through
 * parameterized queries, and the `showAll` flag is reduced to a numeric
 * LIMIT bound as a parameter.
 */
export async function getSummaryStats(
  month?: string,
  session: Session | null = null,
  request?: Request,
) {
  if (!session?.user.id) {
    // Authentication is enforced at the API route layer, but we add a
    // defensive guard here so this server-side helper can never produce
    // cross-user totals if it's invoked without a session by mistake.
    throw new Error('Not authenticated');
  }

  const userId = session.user.id;
  const showAll = request
    ? new URL(request.url).searchParams.get('showAll') === 'true'
    : false;
  const breakdownLimit = showAll ? 1000 : 5;

  const pool = getPool();

  try {
    // Build a reusable parameterized WHERE clause. $1 = user_id, $2 = month
    // (nullable). When month is omitted, the date predicate is no-op.
    const whereSql = `
      WHERE user_id = $1
        AND ($2::text IS NULL
             OR date_trunc('month', fecha) =
                date_trunc('month', $2::date))
    `;
    const baseParams = [userId, month ?? null];

    const [
      incomeResult,
      expenseResult,
      investmentResult,
      trendsResult,
      expenseCategories,
      incomeCategories,
      investmentPerformance,
    ] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(cantidad), 0) AS total, COUNT(*) AS count
           FROM finance_entries
           ${whereSql}
            AND accion = 'Ingreso'`,
        baseParams,
      ),
      pool.query(
        `SELECT COALESCE(SUM(cantidad), 0) AS total, COUNT(*) AS count
           FROM finance_entries
           ${whereSql}
            AND accion = 'Gasto'`,
        baseParams,
      ),
      pool.query(
        `SELECT COALESCE(SUM(cantidad), 0) AS total, COUNT(*) AS count
           FROM finance_entries
           ${whereSql}
            AND accion = 'Inversión'`,
        baseParams,
      ),
      pool.query(
        `SELECT date_trunc('month', fecha) AS month,
                SUM(CASE WHEN accion = 'Ingreso' THEN cantidad ELSE 0 END) AS income,
                SUM(CASE WHEN accion = 'Gasto'   THEN cantidad ELSE 0 END) AS expenses,
                SUM(CASE WHEN accion = 'Inversión' THEN cantidad ELSE 0 END) AS investments
           FROM finance_entries
          WHERE fecha >= NOW() - INTERVAL '6 months'
            AND user_id = $1
          GROUP BY date_trunc('month', fecha)
          ORDER BY month DESC
          LIMIT 6`,
        [userId],
      ),
      pool.query(
        `SELECT que AS category, SUM(cantidad) AS total
           FROM finance_entries
           ${whereSql}
            AND accion = 'Gasto'
          GROUP BY que
          ORDER BY total DESC
          LIMIT $3`,
        [...baseParams, breakdownLimit],
      ),
      pool.query(
        `SELECT que AS category, SUM(cantidad) AS total
           FROM finance_entries
           ${whereSql}
            AND accion = 'Ingreso'
          GROUP BY que
          ORDER BY total DESC
          LIMIT $3`,
        [...baseParams, breakdownLimit],
      ),
      pool.query(
        `SELECT que AS investment, SUM(cantidad) AS total
           FROM finance_entries
           ${whereSql}
            AND accion = 'Inversión'
          GROUP BY que
          ORDER BY total DESC
          LIMIT 5`,
        baseParams,
      ),
    ]);

    const monthlyTrends = trendsResult.rows.map((row) => ({
      month: (row.month as Date).toISOString().split('T')[0],
      income: Number(row.income),
      expenses: Number(row.expenses),
      investments: Number(row.investments),
    }));

    const totalIncome = Number(incomeResult.rows[0].total);
    const totalExpenses = Number(expenseResult.rows[0].total);
    const savingsRate =
      totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

    return {
      totalIncome,
      incomeCount: Number(incomeResult.rows[0].count),
      totalExpense: totalExpenses,
      expenseCount: Number(expenseResult.rows[0].count),
      totalInvestment: Number(investmentResult.rows[0].total),
      investmentCount: Number(investmentResult.rows[0].count),
      balance: totalIncome - totalExpenses,
      monthlyTrends,
      topCategories: expenseCategories.rows.map((row) => ({
        category: row.category as string,
        total: Number(row.total),
      })),
      investmentPerformance: investmentPerformance.rows.map((row) => ({
        investment: row.investment as string,
        total: Number(row.total),
      })),
      savingsRate,
      expenseBreakdown: {
        total: totalExpenses,
        categories: expenseCategories.rows.map((row) => ({
          category: row.category as string,
          total: Number(row.total),
        })),
        averageMonthly: totalExpenses / 12,
        hasMore: !showAll && expenseCategories.rows.length >= 5,
      },
      incomeBreakdown: {
        total: totalIncome,
        categories: incomeCategories.rows.map((row) => ({
          category: row.category as string,
          total: Number(row.total),
        })),
        averageMonthly: totalIncome / 12,
        hasMore: !showAll && incomeCategories.rows.length >= 5,
      },
    };
  } catch (error) {
    console.error('Database Error:', error);
    return {
      totalIncome: 0,
      incomeCount: 0,
      totalExpense: 0,
      expenseCount: 0,
      totalInvestment: 0,
      investmentCount: 0,
      balance: 0,
      monthlyTrends: [],
      topCategories: [],
      investmentPerformance: [],
      savingsRate: 0,
      expenseBreakdown: {
        total: 0,
        categories: [],
        averageMonthly: 0,
      },
    };
  }
}

/**
 * Server-side function to get a single entry by ID.
 *
 * SECURITY: previously concatenated `session.user.id` into the query
 * string, which would have allowed SQL injection if the session id were
 * ever attacker-controlled. Both id and user id are now bound parameters.
 */
export async function getEntryById(
  id: string,
  session: Session | null = null,
): Promise<Entry | null> {
  const pool = getPool();

  try {
    const params: string[] = [id];
    let userScope = '';
    if (session?.user.id) {
      params.push(session.user.id);
      userScope = ' AND user_id = $2';
    }

    const result = await pool.query(
      `SELECT id, fecha, accion, tipo, que, plataforma_pago, cantidad,
              detalle1, detalle2, quien
         FROM finance_entries
        WHERE id = $1${userScope}
        LIMIT 1`,
      params,
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as Entry;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch entry.');
  }
}

/**
 * Server-side function to get distinct options for form dropdowns.
 * Returns options ordered by frequency of use for each field.
 */
export async function getFormOptions(session: Session | null = null) {
  if (!session?.user.id) {
    throw new Error('Not authenticated');
  }

  const pool = getPool();

  try {
    const [tipoResult, queResult, plataformaResult, quienResult] =
      await Promise.all([
        pool.query(
          `SELECT tipo AS value, COUNT(*) AS count
             FROM finance_entries
            WHERE user_id = $1 AND tipo IS NOT NULL AND tipo != ''
            GROUP BY tipo
            ORDER BY count DESC, tipo ASC`,
          [session.user.id],
        ),
        pool.query(
          `SELECT que AS value, COUNT(*) AS count
             FROM finance_entries
            WHERE user_id = $1 AND que IS NOT NULL AND que != ''
            GROUP BY que
            ORDER BY count DESC, que ASC`,
          [session.user.id],
        ),
        pool.query(
          `SELECT plataforma_pago AS value, COUNT(*) AS count
             FROM finance_entries
            WHERE user_id = $1
              AND plataforma_pago IS NOT NULL
              AND plataforma_pago != ''
            GROUP BY plataforma_pago
            ORDER BY count DESC, plataforma_pago ASC`,
          [session.user.id],
        ),
        pool.query(
          `SELECT quien AS value, COUNT(*) AS count
             FROM finance_entries
            WHERE user_id = $1 AND quien IS NOT NULL AND quien != ''
            GROUP BY quien
            ORDER BY count DESC, quien ASC`,
          [session.user.id],
        ),
      ]);

    return {
      tipo: tipoResult.rows.map((row) => row.value as string),
      que: queResult.rows.map((row) => row.value as string),
      plataforma_pago: plataformaResult.rows.map((row) => row.value as string),
      quien: quienResult.rows.map((row) => row.value as string),
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch form options.');
  }
}
