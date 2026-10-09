import { cookies } from 'next/headers';
import { getToken } from 'next-auth/jwt';

/**
 * Resolve the signed-in user's id from the request's NextAuth session cookie.
 *
 * Server actions are public POST endpoints: any argument they receive comes
 * from the caller and can name any user. So the user id must be read on the
 * server, from the signed JWT, never accepted as a parameter.
 *
 * This reads the token with `getToken` rather than
 * `getServerSession(authOptions)` because `authOptions` lives in `app/`, which
 * `lib/` may not import (dependency-cruiser `no-app-imported-from-below`), and
 * the NextAuth route already imports `lib/actions.ts`. The `jwt` callback there
 * stores the user id in `token.id`, the same value its `session` callback
 * copies to `session.user.id`.
 *
 * Throws when there is no valid session.
 */
export async function requireSessionUserId(): Promise<string> {
  const cookieStore = await cookies();
  // `getToken` only needs a request-like object to read cookies from. Passing
  // no headers keeps it to the session cookie (no `Authorization: Bearer`).
  const token = await getToken({
    req: { cookies: cookieStore, headers: {} } as unknown as Parameters<
      typeof getToken
    >[0]['req'],
  });
  const id = token?.id;
  if (typeof id !== 'string' || id === '') {
    throw new Error('Not authenticated');
  }
  return id;
}
