import { createPool } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  try {
    const pool = createPool();

    try {
      const query = `
        SELECT * FROM finance_entries 
        WHERE id = '${id}'
      `;
      
      const { rows } = await pool.query(query);
      
      if (rows.length === 0) {
        return NextResponse.json(
          { error: "Entry not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(rows[0]);
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error("Database Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch entry" },
      { status: 500 }
    );
  }
}
