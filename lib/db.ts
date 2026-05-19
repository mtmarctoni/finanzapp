import {
  createClient,
  createPool,
  type VercelClient,
  type VercelPool,
} from "@vercel/postgres";

/**
 * Run `fn` with a connected `@vercel/postgres` client and guarantee the
 * client is closed afterwards. Existing call sites repeated the
 * `createClient → connect → try / finally → end` pattern dozens of
 * times; this helper is the canonical replacement.
 *
 * Use this for short, transactional sequences (single INSERT / UPDATE /
 * DELETE, or 2–3 chained statements). For pure SELECT-style reads
 * prefer `withPool` — pooled connections survive between requests and
 * avoid the connect/handshake roundtrip.
 */
export async function withClient<T>(
  fn: (client: VercelClient) => Promise<T>
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
      console.error("[db] error closing client:", err);
    }
  }
}

/**
 * Run `fn` with a `@vercel/postgres` pool and tear it down at the end.
 * Mirrors `withClient` but for read-mostly handlers.
 */
export async function withPool<T>(fn: (pool: VercelPool) => Promise<T>): Promise<T> {
  const pool = createPool();
  try {
    return await fn(pool);
  } finally {
    try {
      await pool.end();
    } catch (err) {
      console.error("[db] error closing pool:", err);
    }
  }
}
