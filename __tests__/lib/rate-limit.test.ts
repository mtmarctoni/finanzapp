/**
 * @jest-environment node
 */

import {
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitHeaders,
} from '@/lib/ai/rate-limit';

// Without Upstash credentials the limiter falls back to its in-memory window,
// which is what these tests exercise.
const UPSTASH_ENV = [
  'UPSTASH_REDIS_URL',
  'UPSTASH_REDIS_TOKEN',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
] as const;

const config = { maxRequests: 3, windowMs: 60_000 };

let counter = 0;
/** Each test gets its own key: the in-memory store lives for the module. */
function freshId() {
  counter += 1;
  return `test:${counter}`;
}

beforeAll(() => {
  for (const key of UPSTASH_ENV) delete process.env[key];
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('checkRateLimit (in-memory)', () => {
  it('allows requests up to the limit and counts down the remaining budget', async () => {
    const id = freshId();

    const first = await checkRateLimit(id, config);
    const second = await checkRateLimit(id, config);
    const third = await checkRateLimit(id, config);

    expect(first).toMatchObject({ allowed: true, remaining: 2, retryAfter: 0 });
    expect(second).toMatchObject({ allowed: true, remaining: 1 });
    expect(third).toMatchObject({ allowed: true, remaining: 0 });
  });

  it('blocks once the limit is reached and reports when to retry', async () => {
    const now = 1_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const id = freshId();

    for (let i = 0; i < config.maxRequests; i += 1) {
      await checkRateLimit(id, config);
    }
    const blocked = await checkRateLimit(id, config);

    expect(blocked).toMatchObject({
      allowed: false,
      remaining: 0,
      resetTime: now + config.windowMs,
      retryAfter: config.windowMs / 1000,
    });
  });

  it('starts a new window once the previous one has expired', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const id = freshId();

    for (let i = 0; i <= config.maxRequests; i += 1) {
      await checkRateLimit(id, config);
    }
    expect((await checkRateLimit(id, config)).allowed).toBe(false);

    now.mockReturnValue(1_000_000 + config.windowMs + 1);
    const afterReset = await checkRateLimit(id, config);

    expect(afterReset).toMatchObject({
      allowed: true,
      remaining: config.maxRequests - 1,
    });
  });

  it('keeps separate budgets per identifier', async () => {
    const a = freshId();
    const b = freshId();

    for (let i = 0; i < config.maxRequests; i += 1) {
      await checkRateLimit(a, config);
    }

    expect((await checkRateLimit(a, config)).allowed).toBe(false);
    expect((await checkRateLimit(b, config)).allowed).toBe(true);
  });

  it('uses 10 requests per minute by default', async () => {
    const id = freshId();

    const first = await checkRateLimit(id);

    expect(first.remaining).toBe(9);
    expect(first.limit).toBe(10);
  });
});

describe('getRateLimitHeaders', () => {
  it('reports the configured limit, not the remaining budget', async () => {
    const id = freshId();

    await checkRateLimit(id, config);
    const second = await checkRateLimit(id, config);

    expect(getRateLimitHeaders(second)).toEqual({
      'X-RateLimit-Limit': '3',
      'X-RateLimit-Remaining': '1',
      'X-RateLimit-Reset': String(Math.ceil(second.resetTime / 1000)),
    });
  });

  it('still reports the configured limit when the request is blocked', async () => {
    const id = freshId();

    for (let i = 0; i < config.maxRequests; i += 1) {
      await checkRateLimit(id, config);
    }
    const blocked = await checkRateLimit(id, config);

    expect(getRateLimitHeaders(blocked)['X-RateLimit-Limit']).toBe('3');
    expect(getRateLimitHeaders(blocked)['X-RateLimit-Remaining']).toBe('0');
  });
});

describe('createRateLimitResponse', () => {
  it('returns a 429 with Retry-After and the rate limit headers', async () => {
    const result = {
      allowed: false,
      limit: 3,
      remaining: 0,
      resetTime: 1_060_000,
      retryAfter: 42,
    };

    const res = createRateLimitResponse(result);

    expect(res.status).toBe(429);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('Retry-After')).toBe('42');
    expect(res.headers.get('X-RateLimit-Limit')).toBe('3');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(res.headers.get('X-RateLimit-Reset')).toBe('1060');
    await expect(res.json()).resolves.toEqual({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again in 42 seconds.',
      retryAfter: 42,
    });
  });
});
