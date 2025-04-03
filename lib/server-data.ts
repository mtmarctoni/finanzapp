import { createPool } from '@vercel/postgres';
import type { Entry } from './definitions';

/**
 * Server-side function to get summary statistics
 * This is used by server components
 */
export async function getSummaryStats() {
  try {
    const pool = createPool();

    try {
      // Get income stats
      const incomeResult = await pool.query(`
        SELECT 
          COALESCE(SUM(cantidad), 0) as total,
          COUNT(*) as count
        FROM finance_entries 
        WHERE tipo = 'Ingreso'
      `);

      // Get expense stats
      const expenseResult = await pool.query(`
        SELECT 
          COALESCE(SUM(cantidad), 0) as total,
          COUNT(*) as count
        FROM finance_entries 
        WHERE tipo = 'Gasto'
      `);

      // Get investment stats
      const investmentResult = await pool.query(`
        SELECT 
          COALESCE(SUM(cantidad), 0) as total,
          COUNT(*) as count
        FROM finance_entries 
        WHERE tipo = 'Inversión'
      `);

      return {
        totalIncome: Number(incomeResult.rows[0].total) || 0,
        incomeCount: Number(incomeResult.rows[0].count) || 0,
        totalExpense: Number(expenseResult.rows[0].total) || 0,
        expenseCount: Number(expenseResult.rows[0].count) || 0,
        totalInvestment: Number(investmentResult.rows[0].total) || 0,
        investmentCount: Number(investmentResult.rows[0].count) || 0,
        balance: Number(incomeResult.rows[0].total) - Number(expenseResult.rows[0].total) || 0,
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
      balance: 0
    };
  }
}

/**
 * Server-side function to get a single entry by ID
 */
export async function getEntryById(id: string): Promise<Entry | null> {
  try {
    const pool = createPool();
    
    try {
      const result = await pool.query(`
        SELECT 
          id, 
          fecha, 
          tipo, 
          accion, 
          que, 
          plataforma_pago as "plataformaPago", 
          cantidad, 
          detalle1, 
          detalle2,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM finance_entries
        WHERE id = $1
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
