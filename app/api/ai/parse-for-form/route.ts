import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { generateObject } from "ai";
import { z } from "zod";
import { PARSE_ENTRY_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/ai/rate-limit";
import { raceFreeProviders, executePaidFallback, PAID_FALLBACK } from "@/lib/ai/fallback";
import { hasUserConfirmedPaidFallback } from "@/app/api/ai/confirm-paid/route";

const parsedEntrySchema = z.object({
  fecha: z.string().describe("Transaction date in ISO 8601 format (YYYY-MM-DD)"),
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

// Rate limit config: 5 parse-for-form requests per minute per user
const RATE_LIMIT_CONFIG = { maxRequests: 5, windowMs: 60 * 1000 };

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
  const rateLimitResult = checkRateLimit(`parse-form:${userId}`, RATE_LIMIT_CONFIG);
  if (!rateLimitResult.allowed) {
    console.warn(`[Rate Limit] User ${userId} exceeded parse-form rate limit`, {
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
    const { text, confirmPaidFallback } = body as { 
      text: string;
      confirmPaidFallback?: boolean;
    };
    
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
    console.log(`[Parse Form Start] Request ${requestId}`, {
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
          entry: result.object,
          // Note: Token usage tracking would need to be extracted from response
          inputTokens: 1000,
          outputTokens: 500,
        };
      },
      { endpoint: "/api/ai/parse-for-form" }
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
      
      console.log(`[Parse Form] Free provider succeeded: ${providerUsed}/${modelUsed}`);
    } else {
      // All free providers failed
      console.warn(`[Parse Form] All free providers failed for user ${userId}`, {
        requestId,
        attempts: freeResult.attempts,
      });
      
      // Check if user has already confirmed paid fallback
      const userConfirmed = hasUserConfirmedPaidFallback(userId);
      
      // If user hasn't confirmed and isn't confirming now, ask for confirmation
      if (!userConfirmed && !confirmPaidFallback) {
        return NextResponse.json(
          {
            error: "All free AI providers are currently unavailable",
            message: "We can use Kimi K2.5 (paid) as a fallback. This will cost approximately $0.001-0.005 per request.",
            requiresConfirmation: true,
            fallbackModel: PAID_FALLBACK.name,
            estimatedCost: "$0.001 - $0.005 per request",
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
              // Estimate tokens for cost tracking
              inputTokens: 1000,
              outputTokens: 500,
            };
          },
          { endpoint: "/api/ai/parse-for-form" }
        );
        
        if (paidResult.success) {
          entry = paidResult.result.entry;
          costUsd = paidResult.costUsd;
          providerUsed = PAID_FALLBACK.provider;
          modelUsed = PAID_FALLBACK.modelId;
          
          console.log(`[Parse Form] Paid fallback succeeded: ${providerUsed}/${modelUsed}, cost: $${costUsd.toFixed(6)}`);
        } else {
          // Paid fallback also failed
          return NextResponse.json(
            {
              error: "AI service temporarily unavailable",
              message: "Both free and paid providers are currently unavailable. Please try again later.",
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
            error: "Unexpected error",
            message: "An unexpected error occurred while processing your request.",
          },
          { 
            status: 500,
            headers: getRateLimitHeaders(rateLimitResult),
          }
        );
      }
    }
    
    // Calculate current time for the form
    const now = new Date();
    
    // Parse the date string to create a proper date object
    const fechaDate = new Date(entry.fecha);
    if (isNaN(fechaDate.getTime())) {
      // If date is invalid, use today
      fechaDate.setTime(now.getTime());
    }
    
    // Log successful request
    const duration = Date.now() - startTime;
    console.log(`[Parse Form Success] Request ${requestId} completed`, {
      userId,
      provider: providerUsed,
      model: modelUsed,
      costUsd,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
    
    // Return parsed data for form pre-filling
    // Note: We don't create the entry - we just return the data for the user to confirm
    return NextResponse.json(
      {
        success: true,
        parsedData: {
          fecha: fechaDate.toISOString().split('T')[0], // YYYY-MM-DD
          hora: now.getHours(),
          minuto: now.getMinutes(),
          tipo: entry.tipo,
          accion: entry.accion,
          que: entry.que,
          plataforma_pago: entry.plataforma_pago,
          cantidad: entry.cantidad,
          detalle1: entry.detalle1 || "",
          detalle2: entry.detalle2 || "",
        },
        originalText: text,
        providerUsed,
        modelUsed,
        costUsd: costUsd > 0 ? costUsd : undefined,
        isPaidFallback: costUsd > 0,
        redirectTo: "/new",
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
    console.error(`[Parse Form Error] Request ${requestId}:`, {
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
