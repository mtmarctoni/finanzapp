import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

import { Redis } from '@upstash/redis';
import { headers } from 'next/headers';

import { isPreviewDemo } from '@/lib/demo/policy';

export interface MutationRejection {
  ok: false;
  code:
    | 'PREVIEW_RATE_LIMIT'
    | 'PREVIEW_IDENTITY_REQUIRED'
    | 'PREVIEW_UNAVAILABLE'
    | 'PREVIEW_BATCH_LIMIT';
  status: 429 | 503 | 400;
  error: string;
  retryAfter: number;
}

// One atomic reservation: a denied policy consumes none of the other buckets.
// Each key has its own first-write-anchored window, timed by Redis TTL.
export const RESERVE_SCRIPT = `
local weight = tonumber(ARGV[1])
local retry = 0
for i, key in ipairs(KEYS) do
  local count = tonumber(redis.call('GET', key) or '0')
  if count + weight > tonumber(ARGV[2*i]) then
    retry = math.max(retry, redis.call('PTTL', key), 1)
  end
end
if retry > 0 then return retry end
for i, key in ipairs(KEYS) do
  local count = redis.call('INCRBY', key, weight)
  if count == weight then redis.call('PEXPIRE', key, ARGV[2*i+1]) end
end
return 0
`;

function reject(
  code: MutationRejection['code'],
  status: MutationRejection['status'],
  error: string,
  retryAfter: number,
): MutationRejection {
  return { ok: false, code, status, error, retryAfter };
}

/** Only Vercel's edge-owned single IP; never fall back to caller forwarding headers. */
export function visitorIdentity(source: Pick<Headers, 'get'>): string | null {
  if (process.env.VERCEL !== '1') return null;
  const ip = source.get('x-vercel-forwarded-for')?.trim();
  if (!ip || ip.includes('%') || !isIP(ip)) return null;
  // URL canonicalizes equivalent IPv6 spellings. Fold mapped IPv4 to IPv4 too.
  let normalized =
    isIP(ip) === 6 ? new URL(`http://[${ip}]/`).hostname.slice(1, -1) : ip;
  const mapped = normalized.match(/^::ffff:([\da-f]+):([\da-f]+)$/i);
  if (mapped) {
    const hi = parseInt(mapped[1], 16);
    const lo = parseInt(mapped[2], 16);
    normalized = `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  return createHash('sha256').update(normalized).digest('hex');
}

export async function checkPreviewMutation(
  source: Pick<Headers, 'get'>,
  units = 1,
): Promise<MutationRejection | null> {
  if (!isPreviewDemo()) return null;
  if (!Number.isSafeInteger(units) || units < 1 || units > 60) {
    return reject(
      'PREVIEW_BATCH_LIMIT',
      400,
      'La demo admite como máximo 60 unidades de escritura por operación. Reduce el lote e inténtalo otra vez.',
      0,
    );
  }
  const visitor = visitorIdentity(source);
  if (!visitor) {
    return reject(
      'PREVIEW_IDENTITY_REQUIRED',
      503,
      'No se ha podido identificar tu conexión a la demo. Reintenta en 60 segundos desde la URL de Vercel.',
      60,
    );
  }
  // Same providers as the existing AI limiter; deliberately no process-local fallback.
  const url =
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty values fall through to the alternate provider
    process.env.UPSTASH_REDIS_URL?.trim() ||
    process.env.KV_REST_API_URL?.trim();
  const token =
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty values fall through to the alternate provider
    process.env.UPSTASH_REDIS_TOKEN?.trim() ||
    process.env.KV_REST_API_TOKEN?.trim();
  try {
    if (!url || !token) throw new Error('Redis configuration unavailable');
    const redis = new Redis({
      url,
      token,
      // SDK 1.39.0's retry:false permits two attempts. Never replay weighted EVAL.
      retry: { retries: 0 },
      signal: AbortSignal.timeout(3000),
    });
    const prefix = 'finanzapp:preview:mutations:v1';
    const retryMs = await redis.eval<number[], number>(
      RESERVE_SCRIPT,
      [
        `${prefix}:visitor:${visitor}:minute`,
        `${prefix}:visitor:${visitor}:day`,
        `${prefix}:aggregate:minute`,
        `${prefix}:aggregate:day`,
      ],
      [units, 60, 60000, 1000, 86400000, 300, 60000, 5000, 86400000],
    );
    if (!Number.isFinite(retryMs) || retryMs < 0)
      throw new Error('Invalid Redis result');
    if (retryMs > 0) {
      const retryAfter = Math.max(1, Math.ceil(retryMs / 1000));
      return reject(
        'PREVIEW_RATE_LIMIT',
        429,
        `Has alcanzado el límite de escrituras de la demo. Reintenta en ${retryAfter} segundos.`,
        retryAfter,
      );
    }
    return null;
  } catch {
    return reject(
      'PREVIEW_UNAVAILABLE',
      503,
      'Las escrituras de la demo no están disponibles temporalmente. Reintenta en 60 segundos.',
      60,
    );
  }
}

export async function checkPreviewAction(units = 1) {
  if (!isPreviewDemo()) return null;
  return checkPreviewMutation(await headers(), units);
}

export function mutationResponse(result: MutationRejection): Response {
  return Response.json(result, {
    status: result.status,
    headers: result.retryAfter
      ? { 'Retry-After': String(result.retryAfter) }
      : {},
  });
}

/** Internal weighted-work failures are translated at the public boundary. */
export class PreviewMutationError extends Error {
  constructor(public readonly result: MutationRejection) {
    super(result.error);
  }
}

export async function authorizePreviewAction(units: number) {
  const rejection = await checkPreviewAction(units);
  if (rejection) throw new PreviewMutationError(rejection);
}

export async function authorizePreviewWork(
  source: Pick<Headers, 'get'>,
  units: number,
) {
  const rejection = await checkPreviewMutation(source, Math.max(1, units));
  if (rejection) throw new PreviewMutationError(rejection);
}
