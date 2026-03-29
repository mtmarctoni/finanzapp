/**
 * Rate limiting utilities for AI endpoints
 * Uses in-memory storage for simplicity - can be upgraded to Redis for production
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (consider Redis for multi-instance deployments)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Default rate limit: 10 requests per minute per user
const DEFAULT_MAX_REQUESTS = 10;
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter: number;
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (user ID or IP address)
 * @param config - Rate limit configuration
 * @returns Rate limit check result
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { maxRequests: DEFAULT_MAX_REQUESTS, windowMs: DEFAULT_WINDOW_MS }
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  // Clean up old entries periodically (simple cleanup strategy)
  if (rateLimitStore.size > 10000) {
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  }
  
  const existing = rateLimitStore.get(identifier);
  
  // If no entry or window has passed, create new entry
  if (!existing || existing.resetTime < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(identifier, newEntry);
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: newEntry.resetTime,
      retryAfter: 0,
    };
  }
  
  // Check if limit exceeded
  if (existing.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: existing.resetTime,
      retryAfter: Math.ceil((existing.resetTime - now) / 1000),
    };
  }
  
  // Increment count
  existing.count += 1;
  
  return {
    allowed: true,
    remaining: config.maxRequests - existing.count,
    resetTime: existing.resetTime,
    retryAfter: 0,
  };
}

/**
 * Get rate limit headers for HTTP response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.remaining + (result.allowed ? 1 : 0)),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetTime / 1000)),
  };
}

/**
 * Create a standardized rate limit exceeded response
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded",
      message: `Too many requests. Please try again in ${result.retryAfter} seconds.`,
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfter),
        ...getRateLimitHeaders(result),
      },
    }
  );
}

/**
 * Higher-order function to wrap route handlers with rate limiting
 * Usage: export const POST = withRateLimit(handler, { maxRequests: 5, windowMs: 60000 })
 */
export function withRateLimit(
  handler: (request: Request, context?: { params: Record<string, string> }) => Promise<Response>,
  config?: Partial<RateLimitConfig>
) {
  return async (request: Request, context?: { params: Record<string, string> }): Promise<Response> => {
    // Get user identifier from session or IP
    // Note: This is a placeholder - actual implementation should extract from auth context
    const identifier = request.headers.get("x-user-id") || 
                       request.headers.get("x-forwarded-for") || 
                       "anonymous";
    
    const finalConfig: RateLimitConfig = {
      maxRequests: config?.maxRequests ?? DEFAULT_MAX_REQUESTS,
      windowMs: config?.windowMs ?? DEFAULT_WINDOW_MS,
    };
    
    const result = checkRateLimit(identifier, finalConfig);
    
    if (!result.allowed) {
      return createRateLimitResponse(result);
    }
    
    // Call the actual handler
    const response = await handler(request, context);
    
    // Add rate limit headers to successful response
    const headers = getRateLimitHeaders(result);
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  };
}
