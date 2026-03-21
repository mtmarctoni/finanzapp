import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { generateObject } from "ai";
import { z } from "zod";
import { getModel, getFallbackModel } from "@/lib/ai/config";
import { PARSE_ENTRY_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { createClient } from "@vercel/postgres";
import { v4 as uuidv4 } from "uuid";

const parsedEntrySchema = z.object({
  fecha: z.string().describe("Transaction date in ISO 8601 format"),
  tipo: z.string().describe("Category of the transaction"),
  accion: z
    .enum(["Ingreso", "Gasto", "Inversión"])
    .describe("Transaction type"),
  que: z.string().describe("Short description of the transaction"),
  plataforma_pago: z.string().describe("Payment method"),
  cantidad: z.number().positive().describe("Amount (always positive)"),
  detalle1: z.string().optional().describe("Optional extra detail 1"),
  detalle2: z.string().optional().describe("Optional extra detail 2"),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Se requiere un campo 'text' con el mensaje." },
        { status: 400 }
      );
    }

    let result;
    try {
      result = await generateObject({
        model: getModel(),
        schema: parsedEntrySchema,
        system: PARSE_ENTRY_SYSTEM_PROMPT,
        prompt: text,
      });
    } catch {
      // Fallback to secondary model
      result = await generateObject({
        model: getFallbackModel(),
        schema: parsedEntrySchema,
        system: PARSE_ENTRY_SYSTEM_PROMPT,
        prompt: text,
      });
    }

    const entry = result.object;

    // Insert into database
    const entryId = uuidv4();
    const client = createClient();
    await client.connect();

    try {
      await client.sql`
        INSERT INTO finance_entries (id, fecha, tipo, accion, que, plataforma_pago, cantidad, detalle1, detalle2, user_id)
        VALUES (
          ${entryId},
          ${entry.fecha}::timestamptz,
          ${entry.tipo},
          ${entry.accion},
          ${entry.que},
          ${entry.plataforma_pago},
          ${entry.cantidad},
          ${entry.detalle1 || null},
          ${entry.detalle2 || null},
          ${session.user.id}
        )
      `;

      return NextResponse.json({
        success: true,
        entry,
        entryId,
      });
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error("parse-entry error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al procesar el mensaje.",
      },
      { status: 500 }
    );
  }
}
