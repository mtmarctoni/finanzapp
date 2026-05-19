import { createPool } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Authenticate the user before performing any database work. This route
  // previously interpolated the `id` path parameter directly into a SQL
  // string and exposed every user's entries — both issues are fixed below
  // by using a parameterized query and scoping by `user_id`.
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;

  const pool = createPool();

  try {
    const { rows } = await pool.query(
      `SELECT id, fecha, tipo, accion, que, plataforma_pago, cantidad,
              detalle1, detalle2, quien, created_at, updated_at, user_id
         FROM finance_entries
        WHERE id = $1 AND user_id = $2
        LIMIT 1`,
      [id, userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("Database Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch entry" },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}