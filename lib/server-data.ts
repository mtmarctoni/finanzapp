import { createPool } from '@vercel/postgres';
import type { Entry } from './definitions';
import { Session } from 'next-auth';

/**
 * Server-side function to get summary statistics
 * This is used by server components
 */
export async function getSummaryStats(month?: string, session: Session | null = null) {
  try {
    const pool = createPool();

    try {
      // Build WHERE clause for month filtering
      let whereClause = "";
      if (month) {
        whereClause = `WHERE date_trunc('month', fecha) = date_trunc('month', '${month}'::date)`;
      }
      
      // Add user_id filter if session exists
      if (session?.user?.id) {
        whereClause += whereClause ? " AND " : "WHERE ";
        whereClause += `user_id = '${session.user.id}'`;
      }

      // Get income stats
      const incomeResult = await pool.query(`
        SELECT 
          COALESCE(SUM(cantidad), 0) as total,
          COUNT(*) as count
        FROM finance_entries 
        ${whereClause}
        AND accion = 'Ingreso'
      `);

      // Get expense stats
      const expenseResult = await pool.query(`
        SELECT 
          COALESCE(SUM(cantidad), 0) as total,
          COUNT(*) as count
        FROM finance_entries 
        ${whereClause}
        AND accion = 'Gasto'
      `);

      // Get investment stats
      const investmentResult = await pool.query(`
        SELECT 
          COALESCE(SUM(cantidad), 0) as total,
          COUNT(*) as count
        FROM finance_entries 
        ${whereClause}
        AND accion = 'Inversión'
      `);

      // Get monthly trends (last 6 months)
      const trendsResult = await pool.query(`
        SELECT 
          date_trunc('month', fecha) as month,
          SUM(CASE WHEN accion = 'Ingreso' THEN cantidad ELSE 0 END) as income,
          SUM(CASE WHEN accion = 'Gasto' THEN cantidad ELSE 0 END) as expenses,
          SUM(CASE WHEN accion = 'Inversión' THEN cantidad ELSE 0 END) as investments
        FROM finance_entries
        WHERE fecha >= NOW() - INTERVAL '6 months'
        GROUP BY date_trunc('month', fecha)
        ORDER BY month DESC
        LIMIT 6
      `);

      const monthlyTrends = trendsResult.rows.map(row => ({
        month: row.month.toISOString().split('T')[0],
        income: Number(row.income),
        expenses: Number(row.expenses),
        investments: Number(row.investments)
      }));

      // Get top categories
      const topCategories = await pool.query(`
        SELECT 
          que as category,
          SUM(cantidad) as total
        FROM finance_entries
        ${whereClause}
        AND accion = 'Gasto'
        GROUP BY que
        ORDER BY total DESC
        LIMIT 5
      `);

      // Get investment performance
      const investmentPerformance = await pool.query(`
        SELECT 
          que as investment,
          SUM(cantidad) as total
        FROM finance_entries
        ${whereClause}
        AND accion = 'Inversión'
        GROUP BY que
        ORDER BY total DESC
        LIMIT 5
      `);

      // Calculate savings rate
      const totalIncome = Number(incomeResult.rows[0].total);
      const totalExpenses = Number(expenseResult.rows[0].total);
      const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

      return {
        totalIncome,
        incomeCount: Number(incomeResult.rows[0].count),
        totalExpense: totalExpenses,
        expenseCount: Number(expenseResult.rows[0].count),
        totalInvestment: Number(investmentResult.rows[0].total),
        investmentCount: Number(investmentResult.rows[0].count),
        balance: totalIncome - totalExpenses,
        monthlyTrends,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        topCategories: topCategories.rows.map((row: any) => ({
          category: row.category,
          total: Number(row.total)
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        investmentPerformance: investmentPerformance.rows.map((row: any) => ({
          investment: row.investment,
          total: Number(row.total)
        })),
        savingsRate: savingsRate,
        expenseBreakdown: {
          total: totalExpenses,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          categories: topCategories.rows.map((row: any) => ({
            category: row.category,
            total: Number(row.total)
          })),
          averageMonthly: totalExpenses / 12
        }
      };
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error("Database Error:", error);
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
        averageMonthly: 0
      }
    };
  }
}

/**
 * Server-side function to get a single entry by ID
 */
export async function getEntryById(id: string, session: Session | null = null): Promise<Entry | null> {
  try {
    const pool = createPool();
    
    try {
      const result = await pool.query(`
        SELECT 
          id, 
          fecha, 
          accion,
          tipo,
          que,
          plataforma_pago,
          cantidad,
          detalle1,
          detalle2
        FROM finance_entries
        WHERE id = $1
        ${session?.user?.id ? " AND user_id = '" + session.user.id + "'" : ""}
      `, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0] as Entry;
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch entry.');
  }
}
