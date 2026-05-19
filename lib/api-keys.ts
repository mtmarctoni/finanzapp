import { createClient } from "@vercel/postgres";
import { randomBytes, createHash, createHmac, timingSafeEqual } from "crypto";
import { v4 as uuidv4 } from "uuid";

const PREFIX = "fa_";
const KEY_RANDOM_BYTES = 32; // 256 bits of entropy

export interface ApiKey {
  id: string;
  user_id: string;
  key_hash: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

export interface ApiKeyWithPlaintext extends ApiKey {
  plaintext: string;
}

export type SafeApiKey = Omit<ApiKey, "key_hash">;

let pepperWarningEmitted = false;

/**
 * Compute the storage hash for an API key.
 *
 * SECURITY: API keys used to be stored as plain SHA-256 digests with no
 * salt or pepper. SHA-256 is fast and unsalted hashes can be brute-forced
 * if the database is ever leaked. We now hash with HMAC-SHA-256 keyed by
 * a server-side pepper (`API_KEY_PEPPER`). An attacker who dumps the
 * database alone cannot mount an offline attack — they also need the
 * application secret. Legacy plain-SHA-256 hashes are still accepted at
 * verification time so existing keys keep working through the rollout.
 */
export function hashApiKey(key: string): string {
  const pepper = process.env.API_KEY_PEPPER;
  if (pepper && pepper.length > 0) {
    return createHmac("sha256", pepper).update(key).digest("hex");
  }
  if (!pepperWarningEmitted) {
    console.warn(
      "[api-keys] API_KEY_PEPPER is not set; falling back to plain SHA-256. " +
        "Set API_KEY_PEPPER to a high-entropy random string to enable HMAC hashing."
    );
    pepperWarningEmitted = true;
  }
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Compute the legacy (plain SHA-256) hash. Used as a fallback so keys
 * minted before the pepper rollout still verify.
 */
function legacyHashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Hex-string equality in constant time. Prevents trivial timing leaks
 * even though our verification uses an indexed DB lookup.
 */
function safeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * Generate a cryptographically secure API key.
 * Format: fa_<64 random hex chars>
 * Returns the plaintext key (shown once) and its hash.
 */
export function generateApiKey(): { plaintext: string; hash: string } {
  const plaintext = `${PREFIX}${randomBytes(KEY_RANDOM_BYTES).toString("hex")}`;
  const hash = hashApiKey(plaintext);
  return { plaintext, hash };
}

function stripKeyHash(key: ApiKey): SafeApiKey {
  const { key_hash, ...safeKey } = key;
  return safeKey;
}

/**
 * Create a new API key for a user.
 * Returns the key record including the plaintext key (shown once).
 */
export async function createApiKey(
  userId: string,
  name: string
): Promise<ApiKeyWithPlaintext> {
  const { plaintext, hash } = generateApiKey();
  const id = uuidv4();

  const client = createClient();
  await client.connect();

  try {
    const result = await client.sql`
      INSERT INTO api_keys (id, user_id, key_hash, name)
      VALUES (${id}, ${userId}, ${hash}, ${name})
      RETURNING id, user_id, key_hash, name, is_active, created_at, updated_at, last_used_at
    `;

    return {
      ...(result.rows[0] as ApiKey),
      plaintext,
    };
  } finally {
    await client.end();
  }
}

/**
 * Verify an API key and return the associated user ID.
 * Also updates last_used_at timestamp.
 */
export async function verifyApiKey(
  plaintextKey: string
): Promise<{ userId: string; keyId: string } | null> {
  if (!plaintextKey || !plaintextKey.startsWith(PREFIX)) {
    return null;
  }

  const candidates = Array.from(
    new Set([hashApiKey(plaintextKey), legacyHashApiKey(plaintextKey)])
  );

  const client = createClient();
  await client.connect();

  try {
    // We look up by either of the candidate hashes. ANY ($1) on a text[]
    // is parameterized, so this stays injection-safe.
    const result = await client.query(
      `SELECT id, user_id, key_hash
         FROM api_keys
        WHERE key_hash = ANY($1::text[])
          AND is_active = true
        LIMIT 1`,
      [candidates]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as ApiKey;

    // Final safety net: confirm the stored hash actually matches one of
    // our candidates with a timing-safe comparison.
    const matches = candidates.some((c) => safeHexEqual(c, row.key_hash));
    if (!matches) {
      return null;
    }

    await client.sql`
      UPDATE api_keys
         SET last_used_at = NOW()
       WHERE id = ${row.id}
    `;

    return {
      userId: row.user_id as string,
      keyId: row.id as string,
    };
  } finally {
    await client.end();
  }
}

/**
 * List all API keys for a user (without hashes).
 */
export async function listApiKeys(
  userId: string
): Promise<Omit<ApiKey, "key_hash">[]> {
  const client = createClient();
  await client.connect();

  try {
    const result = await client.sql`
      SELECT id, user_id, name, is_active, created_at, updated_at, last_used_at
        FROM api_keys
       WHERE user_id = ${userId}
       ORDER BY created_at DESC
    `;

    return (result.rows as ApiKey[]).map(stripKeyHash);
  } finally {
    await client.end();
  }
}

export async function getApiKeyById(
  keyId: string,
  userId: string
): Promise<SafeApiKey | null> {
  const client = createClient();
  await client.connect();

  try {
    const result = await client.sql`
      SELECT id, user_id, key_hash, name, is_active, created_at, updated_at, last_used_at
        FROM api_keys
       WHERE id = ${keyId} AND user_id = ${userId}
       LIMIT 1
    `;

    if (result.rows.length === 0) {
      return null;
    }

    return stripKeyHash(result.rows[0] as ApiKey);
  } finally {
    await client.end();
  }
}

/**
 * Revoke (deactivate) an API key.
 */
export async function revokeApiKey(
  keyId: string,
  userId: string
): Promise<boolean> {
  const client = createClient();
  await client.connect();

  try {
    const result = await client.sql`
      UPDATE api_keys
         SET is_active = false, updated_at = NOW()
       WHERE id = ${keyId} AND user_id = ${userId}
    `;

    return (result.rowCount ?? 0) > 0;
  } finally {
    await client.end();
  }
}

/**
 * Delete a API key permanently.
 */
export async function deleteApiKey(
  keyId: string,
  userId: string
): Promise<boolean> {
  const client = createClient();
  await client.connect();

  try {
    const result = await client.sql`
      DELETE FROM api_keys
       WHERE id = ${keyId} AND user_id = ${userId}
    `;

    return (result.rowCount ?? 0) > 0;
  } finally {
    await client.end();
  }
}