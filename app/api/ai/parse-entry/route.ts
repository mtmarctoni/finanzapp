import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { generateObject } from "ai";
import { z } from "zod";
import { PARSE_ENTRY_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { createClient } from "@vercel/postgres";
import { v4 as uuidv4 } from "uuid";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/ai/rate-limit";
import { raceFreeProviders, executePaidFallback, PAID_FALLBACK } from "@/lib/ai/fallback";
import { hasUserConfirmedPaidFallback } from "@/app/api/ai/confirm-paid/route";

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
          error: "Límite de solicitudes excedido",
          message: `Demasiadas solicitudes. Inténtalo de nuevo en ${rateLimitResult.retryAfter} segundos.`,
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
    const { text } = body as { 
      text: string;
    };
    
    // Check both header and body for paid fallback confirmation
    const confirmPaidFallbackHeader = request.headers.get("X-Confirm-Paid");
    const confirmPaidFallbackBody = body.confirmPaidFallback;
    const confirmPaidFallback = confirmPaidFallbackHeader === "true" || confirmPaidFallbackBody === true;
    
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
      textLength: text.length,
      timestamp: new Date().toISOString(),
    });
    
    // Try free providers first (race them)
    const freeResult = await raceFreeProviders(
      async (model) => {
        const result = await generateObject({
          model,
          schema: parsedEntrySchema,
          system: PARSE_ENTRY_SYSTEM_PROMPT,
          prompt: text,
          maxRetries: 1,
        });
        
        return {
          result: {
            entry: result.object,
          },
          // Map AI SDK usage format to our format
          usage: {
            inputTokens: result.usage?.inputTokens ?? 0,
            outputTokens: result.usage?.outputTokens ?? 0,
          },
        };
      },
      { endpoint: "/api/ai/parse-entry" }
    );
    
    let entry: z.infer<typeof parsedEntrySchema>;
    let costUsd = 0;
    let providerUsed = "";
    let modelUsed = "";
    
    if (freeResult.success) {
      // Free provider succeeded
      entry = freeResult.result.entry;
      costUsd = 0;
      providerUsed = freeResult.provider;
      modelUsed = freeResult.model;
      
      console.log(`[Parse Entry] Free provider succeeded: ${providerUsed}/${modelUsed}`);
    } else {
      // All free providers failed
      console.warn(`[Parse Entry] All free providers failed for user ${userId}`, {
        requestId,
        attempts: freeResult.attempts,
      });
      
      // Check if user has already confirmed paid fallback
      const userConfirmed = hasUserConfirmedPaidFallback(userId);
      
      // If user hasn't confirmed and isn't confirming now, ask for confirmation
      if (!userConfirmed && !confirmPaidFallback) {
        return NextResponse.json(
          {
            error: "Todos los proveedores de IA gratuitos están actualmente no disponibles",
            message: "Podemos usar Kimi K2.5 (de pago) como respaldo. Esto costará aproximadamente $0.001-0.005 por solicitud.",
            requiresConfirmation: true,
            fallbackModel: PAID_FALLBACK.name,
            estimatedCost: "$0.001 - $0.005 por solicitud",
            freeProviderErrors: freeResult.attempts,
          },
          { 
            status: 503,
            headers: getRateLimitHeaders(rateLimitResult),
          }
        );
      }
      
      // User confirmed, use paid fallback
      if (confirmPaidFallback || userConfirmed) {
        const paidResult = await executePaidFallback(
          async (model) => {
            const result = await generateObject({
              model,
              schema: parsedEntrySchema,
              system: PARSE_ENTRY_SYSTEM_PROMPT,
              prompt: text,
              maxRetries: 2,
            });
            
            return {
              result: {
                entry: result.object,
              },
              // Map AI SDK usage format to our format
              usage: {
                inputTokens: result.usage?.inputTokens ?? 0,
                outputTokens: result.usage?.outputTokens ?? 0,
              },
            };
          },
          { endpoint: "/api/ai/parse-entry" }
        );
        
        if (paidResult.success) {
          entry = paidResult.result.entry;
          costUsd = paidResult.costUsd;
          providerUsed = PAID_FALLBACK.provider;
          modelUsed = PAID_FALLBACK.modelId;
          
          console.log(`[Parse Entry] Paid fallback succeeded: ${providerUsed}/${modelUsed}, cost: $${costUsd.toFixed(6)}`);
        } else {
          // Paid fallback also failed
          return NextResponse.json(
            {
              error: "Servicio de IA temporalmente no disponible",
              message: "Tanto los proveedores gratuitos como los de pago están actualmente no disponibles. Por favor, inténtalo de nuevo más tarde.",
              freeProviderErrors: freeResult.attempts,
              paidProviderError: paidResult.error,
            },
            { 
              status: 503,
              headers: getRateLimitHeaders(rateLimitResult),
            }
          );
        }
      } else {
        // Should not reach here
        return NextResponse.json(
          {
            error: "Error inesperado",
            message: "Ocurrió un error inesperado al procesar tu solicitud.",
          },
          { 
            status: 500,
            headers: getRateLimitHeaders(rateLimitResult),
          }
        );
      }
    }
    
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
      provider: providerUsed,
      model: modelUsed,
      entryId,
      costUsd,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      {
        success: true,
        entry,
        entryId,
        providerUsed,
        modelUsed,
        costUsd: costUsd > 0 ? costUsd : undefined,
        isPaidFallback: costUsd > 0,
      },
      {
        headers: {
          ...getRateLimitHeaders(rateLimitResult),
          "X-Provider-Used": providerUsed,
          "X-Model-Used": modelUsed,
          "X-Cost-USD": costUsd.toFixed(6),
        },
      }
    );
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Parse Entry Error] Request ${requestId}:`, {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      userId,
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
