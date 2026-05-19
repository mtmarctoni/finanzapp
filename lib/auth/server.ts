import { getServerSession, type Session } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export interface AuthorizedSession {
  session: Session;
  userId: string;
}

/**
 * Helper for route handlers and server actions: returns the active
 * session (and a typed userId), or throws an Error with a known shape
 * that callers can convert to a 401 response.
 *
 * Most route handlers want the response variant — see `requireSessionOrUnauthorized`.
 */
export async function requireSession(): Promise<AuthorizedSession> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }
  return { session, userId: session.user.id };
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * For Route Handlers: returns either an `AuthorizedSession` or a
 * pre-built 401 `NextResponse`. The result is a tagged union so
 * callers can branch with a single `if`.
 *
 *   const auth = await requireSessionOrUnauthorized();
 *   if ("response" in auth) return auth.response;
 *   const { userId } = auth;
 */
export async function requireSessionOrUnauthorized(): Promise<
  AuthorizedSession | { response: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { session, userId: session.user.id };
}
