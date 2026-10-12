import { timingSafeEqual } from 'crypto';

// Server-trusted auth configuration. Never import this module in client code.
interface DevUser {
  id: string;
  email: string;
  password: string;
  name: string;
}

interface CredentialEnvironment {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  DEV_CREDENTIALS?: string;
  ALLOWED_USERS?: string;
}

export function credentialsEnabled(
  env: CredentialEnvironment = process.env,
): boolean {
  return (
    (env.NODE_ENV !== 'production' || env.VERCEL_ENV === 'preview') &&
    Boolean(env.DEV_CREDENTIALS)
  );
}

export function loadDevCredentials(
  raw = process.env.DEV_CREDENTIALS,
): DevUser[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (u): u is DevUser =>
        u &&
        typeof u.id === 'string' &&
        typeof u.email === 'string' &&
        typeof u.password === 'string' &&
        typeof u.name === 'string',
    );
  } catch {
    // Do not log malformed configuration: parser errors can contain secrets.
    console.error('[Auth] Failed to parse DEV_CREDENTIALS');
    return [];
  }
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function isAllowed(
  identity: string | undefined | null,
  raw = process.env.ALLOWED_USERS,
): boolean {
  if (!raw || !identity) return false;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(identity);
}

export function getPublicDemo(env: CredentialEnvironment = process.env) {
  if (env.VERCEL_ENV !== 'preview' || !credentialsEnabled(env)) return null;
  // Match the first account authorize() would use, including duplicate entries.
  const account = loadDevCredentials(env.DEV_CREDENTIALS).find(
    (u) => u.email === 'test@example.com' && u.password === 'password123',
  );
  if (
    account?.id !== 'f7a8b9c0-1e2f-3d45-6a7b-1234567890cd' ||
    !isAllowed(account.name, env.ALLOWED_USERS ?? '')
  )
    return null;

  // Only these intentionally public literals cross the server boundary.
  return { email: 'test@example.com', password: 'password123' };
}
