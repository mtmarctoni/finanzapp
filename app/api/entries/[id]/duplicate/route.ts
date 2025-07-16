import { createClient } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const entryId = params.id;
  const userId = session.user.id;

  try {
    const client = createClient();
    await client.connect();

    try {
      // First, get the entry to duplicate
      const { rows } = await client.sql`
        SELECT * FROM finance_entries 
        WHERE id = ${entryId} AND user_id = ${userId}
      `;
      
      if (rows.length === 0) {
        return NextResponse.json(
          { error: "Entry not found or access denied" },
          { status: 404 }
        );
      }

      const entry = rows[0];
      const newId = uuidv4();
      
      // Create a new entry with the same data but a new ID
      const result = await client.sql`
        INSERT INTO finance_entries (
          id, 
          fecha, 
          tipo, 
          accion, 
          que, 
          plataforma_pago, 
          cantidad, 
          detalle1, 
          detalle2, 
          user_id,
          created_at,
          updated_at
        )
        VALUES (
          ${newId},
          ${entry.fecha},
          ${entry.tipo},
          ${entry.accion},
          ${entry.que},
          ${entry.plataforma_pago},
          ${entry.cantidad},
          ${entry.detalle1 || null},
          ${entry.detalle2 || null},
          ${userId},
          NOW(),
          NOW()
        )
        RETURNING *
      `;

      return NextResponse.json(result.rows[0]);
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error("Database Error:", error);
    return NextResponse.json(
      { error: "Failed to duplicate entry" },
      { status: 500 }
    );
  }
}
