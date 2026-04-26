import { verifyApiKey } from "./api-keys";
import {
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitHeaders,
} from "./ai/rate-limit";

export interface ApiAuthContext {
  userId: string;
  keyId: string;
}

export interface ApiAuthenticationResult {
  auth: ApiAuthContext | null;
  rateLimitResponse?: Response;
  rateLimitHeaders?: Record<string, string>;
}

/**
 * Extract and verify an API key from a request.
 * Looks for `X-API-Key` header or `Authorization: Bearer <key>`.
 * Returns null if missing or invalid.
 */
export async function authenticateApiRequest(
  request: Request
): Promise<ApiAuthContext | null> {
  // Check X-API-Key header first
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const result = await verifyApiKey(apiKey);
    if (result) {
      return result;
    }
  }

  // Fallback to Authorization: Bearer <key>
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    const result = await verifyApiKey(token);
    if (result) {
      return result;
    }
  }

  return null;
}

export async function authenticateAndRateLimitApiRequest(
  request: Request
): Promise<ApiAuthenticationResult> {
  const auth = await authenticateApiRequest(request);

  if (!auth) {
    return { auth: null };
  }

  const rateLimitResult = checkRateLimit(`api-key:${auth.keyId}`, {
    maxRequests: 60,
    windowMs: 60 * 1000,
  });

  if (!rateLimitResult.allowed) {
    return {
      auth,
      rateLimitResponse: createRateLimitResponse(rateLimitResult),
    };
  }

  return {
    auth,
    rateLimitHeaders: getRateLimitHeaders(rateLimitResult),
  };
}
