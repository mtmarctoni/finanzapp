import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  streamText,
  stepCountIs,
  type UIMessage,
  convertToModelMessages,
} from "ai";
import { CHAT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  createFinanceEntryTool,
  getRecentEntriesTool,
  getSpendingByCategoryTool,
  getTotalByPeriodTool,
} from "@/lib/ai/tools";
import { raceFreeProviders, executePaidFallback, PAID_FALLBACK } from "@/lib/ai/fallback";
import { checkRateLimit, createRateLimitResponse, getRateLimitHeaders } from "@/lib/ai/rate-limit";
import { hasUserConfirmedPaidFallback } from "@/app/api/ai/confirm-paid/route";

// Rate limit config: 5 chat requests per minute per user
const RATE_LIMIT_CONFIG = { maxRequests: 5, windowMs: 60 * 1000 };

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  // Authentication check
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return new Response("No autorizado", { status: 401 });
  }
  
  const userId = session.user.id;
  
  // Rate limiting check
  const rateLimitResult = checkRateLimit(`chat:${userId}`, RATE_LIMIT_CONFIG);
  if (!rateLimitResult.allowed) {
    console.warn(`[Rate Limit] User ${userId} exceeded chat rate limit`, {
      requestId,
      retryAfter: rateLimitResult.retryAfter,
    });
    return createRateLimitResponse(rateLimitResult);
  }
  
  try {
    const body = await request.json();
    const { messages } = body as { 
      messages: UIMessage[];
    };
    
    // Check both header and body for paid fallback confirmation
    const confirmPaidFallbackHeader = request.headers.get("X-Confirm-Paid");
    const confirmPaidFallbackBody = body.confirmPaidFallback;
    const confirmPaidFallback = confirmPaidFallbackHeader === "true" || confirmPaidFallbackBody === true;
    
    if (!messages || !Array.isArray(messages)) {
      return new Response("Se requiere un array de 'messages'.", {
        status: 400,
      });
    }
    
    const tools = {
      createFinanceEntry: createFinanceEntryTool(userId),
      getRecentEntries: getRecentEntriesTool(userId),
      getSpendingByCategory: getSpendingByCategoryTool(userId),
      getTotalByPeriod: getTotalByPeriodTool(userId),
    };
    
    const modelMessages = await convertToModelMessages(messages, { tools });
    
    // Try free providers first (race them)
    const freeResult = await raceFreeProviders(
      async (model) => {
        const result = streamText({
          model,
          system: CHAT_SYSTEM_PROMPT,
          messages: modelMessages,
          tools,
          stopWhen: stepCountIs(3),
          maxRetries: 1,
        });
        
        // For streaming, we can't easily get token counts
        // The fallback function will use estimates
        return {
          result,
          usage: undefined,
        };
      },
      { endpoint: "/api/ai/chat" }
    );
    
    if (freeResult.success) {
      // Free provider succeeded
      const response = freeResult.result.toUIMessageStreamResponse();
      
      // Add rate limit headers
      const headers = getRateLimitHeaders(rateLimitResult);
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      // Add provider info header
      response.headers.set("X-Provider-Used", freeResult.provider);
      response.headers.set("X-Model-Used", freeResult.model);
      response.headers.set("X-Cost-USD", "0.00");
      
      const duration = Date.now() - startTime;
      console.log(`[Chat Success] Request ${requestId} completed with free provider`, {
        userId,
        provider: freeResult.provider,
        model: freeResult.model,
        durationMs: duration,
        timestamp: new Date().toISOString(),
      });
      
      return response;
    }
    
    // All free providers failed
    console.warn(`[Chat] All free providers failed for user ${userId}`, {
      requestId,
      attempts: freeResult.attempts,
    });
    
    // Check if user has already confirmed paid fallback
    const userConfirmed = hasUserConfirmedPaidFallback(userId);
    
    // If user hasn't confirmed and isn't confirming now, ask for confirmation
    if (!userConfirmed && !confirmPaidFallback) {
      return new Response(
        JSON.stringify({
          error: "Todos los proveedores de IA gratuitos están actualmente no disponibles",
          message: "Podemos usar Kimi K2.5 (de pago) como respaldo. Esto costará aproximadamente $0.001-0.005 por solicitud.",
          requiresConfirmation: true,
          fallbackModel: PAID_FALLBACK.name,
          estimatedCost: "$0.001 - $0.005 por solicitud",
          freeProviderErrors: freeResult.attempts,
        }),
        {
          status: 503, // Service Unavailable
          headers: {
            "Content-Type": "application/json",
            ...getRateLimitHeaders(rateLimitResult),
          },
        }
      );
    }
    
    // User confirmed, use paid fallback
    if (confirmPaidFallback || userConfirmed) {
      const paidResult = await executePaidFallback(
        async (model) => {
          const result = streamText({
            model,
            system: CHAT_SYSTEM_PROMPT,
            messages: modelMessages,
            tools,
            stopWhen: stepCountIs(3),
            maxRetries: 2,
          });
          
          // For streaming, we can't easily get token counts
          // The fallback function will use estimates
          return {
            result,
            usage: undefined,
          };
        },
        { endpoint: "/api/ai/chat" }
      );
      
      if (paidResult.success) {
        const response = paidResult.result.toUIMessageStreamResponse();
        
        // Add rate limit headers
        const headers = getRateLimitHeaders(rateLimitResult);
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        
        // Add provider and cost info
        response.headers.set("X-Provider-Used", PAID_FALLBACK.provider);
        response.headers.set("X-Model-Used", PAID_FALLBACK.modelId);
        response.headers.set("X-Cost-USD", paidResult.costUsd.toFixed(6));
        response.headers.set("X-Paid-Fallback", "true");
        
        const duration = Date.now() - startTime;
        console.log(`[Chat Success] Request ${requestId} completed with paid fallback`, {
          userId,
          provider: PAID_FALLBACK.provider,
          model: PAID_FALLBACK.modelId,
          costUsd: paidResult.costUsd,
          durationMs: duration,
          timestamp: new Date().toISOString(),
        });
        
        return response;
      }
      
      // Paid fallback also failed
      return new Response(
        JSON.stringify({
          error: "Servicio de IA temporalmente no disponible",
          message: "Tanto los proveedores gratuitos como los de pago están actualmente no disponibles. Por favor, inténtalo de nuevo más tarde.",
          freeProviderErrors: freeResult.attempts,
          paidProviderError: paidResult.error,
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            ...getRateLimitHeaders(rateLimitResult),
          },
        }
      );
    }
    
    // Should not reach here
    return new Response(
      JSON.stringify({
        error: "Error inesperado",
        message: "Ocurrió un error inesperado al procesar tu solicitud.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...getRateLimitHeaders(rateLimitResult),
        },
      }
    );
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Chat Error] Request ${requestId}:`, {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
    
    return new Response("Error interno del servidor.", { 
      status: 500,
      headers: getRateLimitHeaders(rateLimitResult),
    });
  }
}
