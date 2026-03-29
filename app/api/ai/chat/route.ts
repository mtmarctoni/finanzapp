import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  streamText,
  stepCountIs,
  type UIMessage,
  convertToModelMessages,
} from "ai";
import { aiModel, getModel, AI_PROVIDER } from "@/lib/ai/config";
import { CHAT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  createFinanceEntryTool,
  getRecentEntriesTool,
  getSpendingByCategoryTool,
  getTotalByPeriodTool,
} from "@/lib/ai/tools";
import { checkRateLimit, createRateLimitResponse, getRateLimitHeaders } from "@/lib/ai/rate-limit";

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
    const { messages } = body as { messages: UIMessage[] };
    
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
    
    // Use provider-specific model selection with fallback
    const model = aiModel;
    
    const result = streamText({
      model,
      system: CHAT_SYSTEM_PROMPT,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(3),
      maxRetries: 2, // Add retry logic for transient failures
      onError: (error) => {
        console.error(`[Chat Stream Error] Request ${requestId}:`, {
          error: error instanceof Error ? error.message : "Unknown error",
          userId,
          provider: AI_PROVIDER,
          timestamp: new Date().toISOString(),
        });
      },
    });
    
    const response = result.toUIMessageStreamResponse();
    
    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimitResult);
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    // Log successful request
    const duration = Date.now() - startTime;
    console.log(`[Chat Success] Request ${requestId} completed`, {
      userId,
      provider: AI_PROVIDER,
      messageCount: messages.length,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
    
    return response;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Chat Error] Request ${requestId}:`, {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      provider: AI_PROVIDER,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
    
    return new Response("Error interno del servidor.", { 
      status: 500,
      headers: getRateLimitHeaders(rateLimitResult),
    });
  }
}
