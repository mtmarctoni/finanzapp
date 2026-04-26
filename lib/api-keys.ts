import { createClient } from "@vercel/postgres";
import { randomBytes, createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";

const PREFIX = "fa_";

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

/**
 * Generate a cryptographically secure API key.
 * Format: fa_<32 random hex chars>
 * Returns the plaintext key (shown once to user) and its hash.
 */
export function generateApiKey(): { plaintext: string; hash: string } {
  const plaintext = `${PREFIX}${randomBytes(24).toString("hex")}`;
  const hash = hashApiKey(plaintext);
  return { plaintext, hash };
}

/**
 * Hash an API key using SHA-256.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function stripKeyHash(key: ApiKey): SafeApiKey {
  const safeKey = { ...key };
  delete safeKey.key_hash;
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
  const hash = hashApiKey(plaintextKey);

  const client = createClient();
  await client.connect();

  try {
    const result = await client.sql`
      SELECT id, user_id
      FROM api_keys
      WHERE key_hash = ${hash}
        AND is_active = true
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

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
export async function listApiKeys(userId: string): Promise<Omit<ApiKey, "key_hash">[]> {
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

    return result.rowCount > 0;
  } finally {
    await client.end();
  }
}

/**
 * Delete an API key permanently.
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

    return result.rowCount > 0;
  } finally {
    await client.end();
  }
}
