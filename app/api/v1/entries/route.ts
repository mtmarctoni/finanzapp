import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@vercel/postgres";
import { v4 as uuidv4 } from "uuid";
import { authenticateAndRateLimitApiRequest } from "@/lib/api-auth";
import { CreateEntrySchema, BatchCreateEntrySchema } from "@/lib/api-validation";
import type { CreateEntryInput } from "@/lib/api-validation";
import { ZodError } from "zod";

function jsonWithHeaders(body: unknown, init: ResponseInit = {}) {
  const response = NextResponse.json(body, init);

  if (init.headers) {
    const headers = new Headers(init.headers);
    headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

/**
 * POST /api/v1/entries
 * Creates one or more finance entries using API key authentication.
 *
 * Auth: X-API-Key header or Authorization: Bearer <key>
 *
 * Body (single):
 *   {
 *     "fecha": "2024-01-15T10:30:00Z",
 *     "tipo": "Salario",
 *     "accion": "Ingreso",
 *     "que": "Trabajo",
 *     "plataforma_pago": "Transferencia",
 *     "cantidad": 2500.50,
 *     "detalle1": null,
 *     "detalle2": null,
 *     "quien": "Yo"
 *   }
 *
 * Body (batch):
 *   {
 *     "entries": [ ... ]
 *   }
 */
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toISOString();

  // Log incoming request details
  console.log(`\n[${timestamp}] 🔵 API Request #${requestId}`);
  console.log(`  Method: ${request.method}`);
  console.log(`  URL: ${request.url}`);
  console.log(`  Headers:`);
  request.headers.forEach((value, key) => {
    // Mask API key for security
    if (key.toLowerCase().includes('authorization') || key.toLowerCase().includes('x-api-key')) {
      const masked = value.length > 10
        ? `${value.substring(0, 10)}...${value.substring(value.length - 4)}`
        : '***';
      console.log(`    ${key}: ${masked}`);
    } else {
      console.log(`    ${key}: ${value}`);
    }
  });

  const { auth, rateLimitHeaders, rateLimitResponse } =
    await authenticateAndRateLimitApiRequest(request);

  console.log(`[${timestamp}] 🔑 Auth Result #${requestId}:`, {
    authenticated: !!auth,
    userId: auth?.userId || 'none',
    rateLimitHeaders: rateLimitHeaders ? rateLimitHeaders : {}
  });

  if (!auth) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: "Invalid or missing API key. Provide it via X-API-Key header or Authorization: Bearer <key>.",
      },
      { status: 401 }
    );
  }

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await request.json();
    console.log(`[${timestamp}] 📦 Body #${requestId}:`, JSON.stringify(body, null, 2));
  } catch {
    return jsonWithHeaders(
      { error: "Bad Request", message: "Invalid JSON body." },
      { status: 400, headers: rateLimitHeaders }
    );
  }

  // 3. Detect batch vs single
  const isBatch =
    typeof body === "object" &&
    body !== null &&
    "entries" in body &&
    Array.isArray((body as Record<string, unknown>).entries);

  console.log(`[${timestamp}] 📋 Validation #${requestId}:`, {
    isBatch,
    bodyType: typeof body,
    keys: typeof body === 'object' && body !== null ? Object.keys(body as object) : []
  });

  let entriesToCreate: CreateEntryInput[];

  try {
    if (isBatch) {
      const parsed = BatchCreateEntrySchema.parse(body);
      entriesToCreate = parsed.entries;
      console.log(`[${timestamp}] ✅ Batch validated #${requestId}:`, {
        count: entriesToCreate.length,
        entries: entriesToCreate.map(e => ({
          tipo: e.tipo,
          accion: e.accion,
          que: e.que,
          cantidad: e.cantidad
        }))
      });
    } else {
      const parsed = CreateEntrySchema.parse(body);
      entriesToCreate = [parsed];
      console.log(`[${timestamp}] ✅ Single validated #${requestId}:`, {
        tipo: parsed.tipo,
        accion: parsed.accion,
        que: parsed.que,
        cantidad: parsed.cantidad
      });
    }
  } catch (err) {
    if (err instanceof ZodError) {
      const issues = err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      return jsonWithHeaders(
        { error: "Validation Error", message: "Request body failed validation.", issues },
        { status: 422, headers: rateLimitHeaders }
      );
    }
    return jsonWithHeaders(
      { error: "Validation Error", message: "Invalid request body." },
      { status: 422, headers: rateLimitHeaders }
    );
  }

  // 4. Insert into database
  const client = createClient();
  await client.connect();

  console.log(`[${timestamp}] 💾 DB Connection #${requestId}: connected`);

  try {
    await client.query("BEGIN");
    console.log(`[${timestamp}] 🔃 Transaction #${requestId}: BEGIN`);

    const createdEntries: Array<{
      id: string;
      fecha: string;
      tipo: string;
      accion: string;
      que: string;
      plataforma_pago: string;
      cantidad: number;
      detalle1: string | null;
      detalle2: string | null;
      quien: string;
    }> = [];

    for (const [index, entry] of entriesToCreate.entries()) {
      const id = uuidv4();
      console.log(`[${timestamp}] 📝 Insert #${requestId} [${index}]:`, {
        id,
        tipo: entry.tipo,
        accion: entry.accion,
        que: entry.que,
        cantidad: entry.cantidad,
        user_id: auth!.userId
      });

      const result = await client.sql`
        INSERT INTO finance_entries (
          id, fecha, tipo, accion, que, plataforma_pago, cantidad, detalle1, detalle2, quien, user_id
        ) VALUES (
          ${id},
          ${entry.fecha}::timestamptz,
          ${entry.tipo},
          ${entry.accion},
          ${entry.que},
          ${entry.plataforma_pago},
          ${entry.cantidad},
          ${entry.detalle1 ?? null},
          ${entry.detalle2 ?? null},
          ${entry.quien},
          ${auth!.userId}
        )
        RETURNING id, fecha, tipo, accion, que, plataforma_pago, cantidad, detalle1, detalle2, quien
      `;
      createdEntries.push(result.rows[0] as (typeof createdEntries)[0]);
    }

    await client.query("COMMIT");
    console.log(`[${timestamp}] ✅ Transaction #${requestId}: COMMIT - ${createdEntries.length} entries created`);

    console.log(`[${timestamp}] 🎉 Response #${requestId}: 201 Created`, {
      success: true,
      count: createdEntries.length
    });

    return jsonWithHeaders(
      {
        success: true,
        data: isBatch ? createdEntries : createdEntries[0],
      },
      { status: 201, headers: rateLimitHeaders }
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error(`[${timestamp}] ❌ Error #${requestId}:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    console.error("Public API create entry error:", error);
    return jsonWithHeaders(
      { error: "Internal Server Error", message: "Failed to create entry." },
      { status: 500, headers: rateLimitHeaders }
    );
  } finally {
    await client.end();
    console.log(`[${timestamp}] 🔚 Request #${requestId}: completed\n`);
  }
}
