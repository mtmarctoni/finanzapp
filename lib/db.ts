import {
  createClient,
  createPool,
  type VercelClient,
  type VercelPool,
} from '@vercel/postgres';

let pool: VercelPool | null = null;

/**
 * Return the application's singleton connection pool, creating it on
 * first call. The pool lives for the lifetime of the process so
 * connections are reused across requests.
 */
export function getPool(): VercelPool {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

/**
 * Run `fn` with a connected `@vercel/postgres` client and guarantee the
 * client is closed afterwards. Existing call sites repeated the
 * `createClient → connect → try / finally → end` pattern dozens of
 * times; this helper is the canonical replacement.
 *
 * Use this for short, transactional sequences (single INSERT / UPDATE /
 * DELETE, or 2–3 chained statements). For pure SELECT-style reads
 * prefer the singleton pool via `getPool()` — pooled connections
 * survive between requests and avoid the connect/handshake roundtrip.
 */
export async function withClient<T>(
  fn: (client: VercelClient) => Promise<T>,
): Promise<T> {
  const client = createClient();
  await client.connect();
  try {
    return await fn(client);
  } finally {
    try {
      await client.end();
    } catch (err) {
      // Surface but don't mask the original error in the caller.
      console.error('[db] error closing client:', err);
    }
  }
}

/**
 * Run `fn` with the application's singleton connection pool.
 * Connections are reused across requests, avoiding the overhead of
 * creating and destroying a pool on every invocation.
 */
export async function withPool<T>(
  fn: (pool: VercelPool) => Promise<T>,
): Promise<T> {
  return await fn(getPool());
}
