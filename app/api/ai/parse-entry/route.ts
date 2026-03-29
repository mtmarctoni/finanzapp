import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { generateObject } from "ai";
import { z } from "zod";
import { aiModel, AI_PROVIDER } from "@/lib/ai/config";
import { PARSE_ENTRY_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { createClient } from "@vercel/postgres";
import { v4 as uuidv4 } from "uuid";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/ai/rate-limit";

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

// Rate limit config: 3 parse requests per minute per user
const RATE_LIMIT_CONFIG = { maxRequests: 3, windowMs: 60 * 1000 };

/**
 * Helper function to execute database operations with proper connection management.
 * Ensures client is always closed, even if connection fails.
 */
async function withDbClient<T>(
  operation: (client: ReturnType<typeof createClient>) => Promise<T>
): Promise<T> {
  const client = createClient();
  
  try {
    await client.connect();
    return await operation(client);
  } finally {
    try {
      await client.end();
    } catch (endError) {
      // Log but don't throw - we want to preserve the original error
      console.error("Error closing database client:", endError);
    }
  }
}

/**
 * Validates ISO 8601 date format before casting to timestamptz
 */
function validateIsoDate(dateStr: string, fieldName: string): void {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/;
  if (!isoDateRegex.test(dateStr)) {
    throw new Error(`Invalid ${fieldName} format. Expected ISO 8601 date (e.g., 2026-03-21)`);
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  // Authentication check
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "No autorizado" }, 
      { status: 401 }
    );
  }
  
  const userId = session.user.id;
  
  // Rate limiting check
  const rateLimitResult = checkRateLimit(`parse:${userId}`, RATE_LIMIT_CONFIG);
  if (!rateLimitResult.allowed) {
    console.warn(`[Rate Limit] User ${userId} exceeded parse rate limit`, {
      requestId,
      retryAfter: rateLimitResult.retryAfter,
    });
    return NextResponse.json(
      { 
        error: "Rate limit exceeded",
        message: `Too many requests. Please try again in ${rateLimitResult.retryAfter} seconds.`,
        retryAfter: rateLimitResult.retryAfter,
      },
      { 
        status: 429,
        headers: getRateLimitHeaders(rateLimitResult),
      }
    );
  }
  
  try {
    const body = await request.json();
    const { text } = body;
    
    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Se requiere un campo 'text' con el mensaje." },
        { 
          status: 400,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      );
    }
    
    // Log AI request start
    console.log(`[Parse Entry Start] Request ${requestId}`, {
      userId,
      provider: AI_PROVIDER,
      textLength: text.length,
      timestamp: new Date().toISOString(),
    });
    
    const result = await generateObject({
      model: aiModel,
      schema: parsedEntrySchema,
      system: PARSE_ENTRY_SYSTEM_PROMPT,
      prompt: text,
      maxRetries: 2, // Add retry logic for transient failures
    });
    
    const entry = result.object;
    
    // Validate date format before database operation
    validateIsoDate(entry.fecha, "fecha");
    
    // Insert into database with connection management
    const entryId = uuidv4();
    
    await withDbClient(async (client) => {
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
          ${userId}
        )
      `;
    });
    
    // Log successful request
    const duration = Date.now() - startTime;
    console.log(`[Parse Entry Success] Request ${requestId} completed`, {
      userId,
      provider: AI_PROVIDER,
      entryId,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      {
        success: true,
        entry,
        entryId,
      },
      {
        headers: getRateLimitHeaders(rateLimitResult),
      }
    );
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Parse Entry Error] Request ${requestId}:`, {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      provider: AI_PROVIDER,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      {
        success: false,
        error: "Error al procesar el mensaje.",
      },
      { 
        status: 500,
        headers: getRateLimitHeaders(rateLimitResult),
      }
    );
  }
}
