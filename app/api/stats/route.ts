import { createPool } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
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

      return NextResponse.json({
        totalIncome: Number(incomeResult.rows[0].total) || 0,
        incomeCount: Number(incomeResult.rows[0].count) || 0,
        totalExpense: Number(expenseResult.rows[0].total) || 0,
        expenseCount: Number(expenseResult.rows[0].count) || 0,
        totalInvestment: Number(investmentResult.rows[0].total) || 0,
        investmentCount: Number(investmentResult.rows[0].count) || 0,
        balance: Number(incomeResult.rows[0].total) - Number(expenseResult.rows[0].total) || 0,
      });
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error("Database Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
