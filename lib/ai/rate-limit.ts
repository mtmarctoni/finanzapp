import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const inMemoryStore = new Map<string, RateLimitEntry>();

const DEFAULT_MAX_REQUESTS = 10;
const DEFAULT_WINDOW_MS = 60 * 1000;

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

let upstashClient: Redis | null = null;
const ratelimitInstances = new Map<string, Ratelimit>();

function getUpstash(): Redis | null {
  if (!upstashClient) {
    const url =
      process.env.UPSTASH_REDIS_URL || process.env.KV_REST_API_URL || undefined;
    const token =
      process.env.UPSTASH_REDIS_TOKEN ||
      process.env.KV_REST_API_TOKEN ||
      undefined;

    if (url && token) {
      upstashClient = new Redis({ url, token });
    } else if (url || token) {
      const missing = !url
        ? 'UPSTASH_REDIS_URL / KV_REST_API_URL'
        : 'UPSTASH_REDIS_TOKEN / KV_REST_API_TOKEN';
      console.warn(
        `[rate-limit] ${missing} is not set. Upstash Redis rate limiting is disabled. Falling back to in-memory rate limiting.`,
      );
    }
  }
  return upstashClient;
}

function getRatelimit(config: RateLimitConfig): Ratelimit | null {
  const client = getUpstash();
  if (!client) {
    return null;
  }

  const configKey = `${config.maxRequests}:${config.windowMs}`;
  let rl = ratelimitInstances.get(configKey);

  if (!rl) {
    rl = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(
        config.maxRequests,
        `${config.windowMs} ms`,
      ),
      analytics: true,
      prefix: 'ratelimit',
    });
    ratelimitInstances.set(configKey, rl);
  }

  return rl;
}

function cleanupInMemory(): void {
  if (inMemoryStore.size > 10000) {
    const now = Date.now();
    for (const [key, entry] of inMemoryStore.entries()) {
      if (entry.resetTime < now) {
        inMemoryStore.delete(key);
      }
    }
  }
}

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = {
    maxRequests: DEFAULT_MAX_REQUESTS,
    windowMs: DEFAULT_WINDOW_MS,
  },
): Promise<RateLimitResult> {
  const rl = getRatelimit(config);

  if (rl) {
    try {
      const result = await rl.limit(identifier);
      return {
        allowed: result.success,
        remaining: result.remaining,
        resetTime: Date.now() + config.windowMs,
        retryAfter: Math.max(0, Math.ceil((result.reset - Date.now()) / 1000)),
      };
    } catch (error) {
      console.error(
        `[rate-limit] Upstash Redis error, falling back to in-memory:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  const now = Date.now();

  cleanupInMemory();

  const existing = inMemoryStore.get(identifier);

  if (!existing || existing.resetTime < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    inMemoryStore.set(identifier, newEntry);

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: newEntry.resetTime,
      retryAfter: 0,
    };
  }

  if (existing.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: existing.resetTime,
      retryAfter: Math.ceil((existing.resetTime - now) / 1000),
    };
  }

  existing.count += 1;

  return {
    allowed: true,
    remaining: config.maxRequests - existing.count,
    resetTime: existing.resetTime,
    retryAfter: 0,
  };
}

export function getRateLimitHeaders(
  result: RateLimitResult,
): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.remaining + (result.allowed ? 1 : 0)),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
  };
}

export function createRateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Too many requests. Please try again in ${result.retryAfter} seconds.`,
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfter),
        ...getRateLimitHeaders(result),
      },
    },
  );
}

export function withRateLimit(
  handler: (
    request: Request,
    context?: { params: Record<string, string> },
  ) => Promise<Response>,
  config?: Partial<RateLimitConfig>,
) {
  return async (
    request: Request,
    context?: { params: Record<string, string> },
  ): Promise<Response> => {
    const identifier =
      request.headers.get('x-user-id') ||
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'anonymous';

    const finalConfig: RateLimitConfig = {
      maxRequests: config?.maxRequests ?? DEFAULT_MAX_REQUESTS,
      windowMs: config?.windowMs ?? DEFAULT_WINDOW_MS,
    };

    const result = await checkRateLimit(identifier, finalConfig);

    if (!result.allowed) {
      return createRateLimitResponse(result);
    }

    const response = await handler(request, context);

    const headers = getRateLimitHeaders(result);
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  };
}
