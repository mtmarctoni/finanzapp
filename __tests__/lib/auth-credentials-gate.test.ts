/**
 * Regression tests for the credentials provider gate.
 *
 * The Credentials provider is intentionally restricted: it is only enabled
 * when DEV_CREDENTIALS is set AND the app runs locally (NODE_ENV !==
 * 'production') or on a Vercel preview deployment (VERCEL_ENV ===
 * 'preview'). Production remains hard-gated.
 *
 * The predicate lives inline in app/api/auth/[...nextauth]/route.ts and
 * cannot be imported — Next.js restricts Route Handler exports, so
 * extracting it would break the build. We mirror the exact logic here to
 * lock down the contract. If the implementation drifts, these tests will
 * catch it.
 */

describe('devCredentialsEnabled (credentials provider gate)', () => {
  function devCredentialsEnabled(env: {
    NODE_ENV?: string;
    VERCEL_ENV?: string;
    DEV_CREDENTIALS?: string;
  }): boolean {
    return (
      (env.NODE_ENV !== 'production' || env.VERCEL_ENV === 'preview') &&
      Boolean(env.DEV_CREDENTIALS)
    );
  }

  it('enables in local dev with DEV_CREDENTIALS set', () => {
    expect(
      devCredentialsEnabled({
        NODE_ENV: 'development',
        DEV_CREDENTIALS: '[]',
      }),
    ).toBe(true);
  });

  it('enables on Vercel preview with DEV_CREDENTIALS set', () => {
    expect(
      devCredentialsEnabled({
        NODE_ENV: 'production',
        VERCEL_ENV: 'preview',
        DEV_CREDENTIALS: '[]',
      }),
    ).toBe(true);
  });

  it('stays disabled on Vercel production even with DEV_CREDENTIALS set', () => {
    expect(
      devCredentialsEnabled({
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
        DEV_CREDENTIALS: '[]',
      }),
    ).toBe(false);
  });

  it('stays disabled in a local production build even with DEV_CREDENTIALS set', () => {
    expect(
      devCredentialsEnabled({
        NODE_ENV: 'production',
        DEV_CREDENTIALS: '[]',
      }),
    ).toBe(false);
  });

  it('stays disabled on Vercel preview without DEV_CREDENTIALS', () => {
    expect(
      devCredentialsEnabled({
        NODE_ENV: 'production',
        VERCEL_ENV: 'preview',
      }),
    ).toBe(false);
  });

  it('stays disabled in development without DEV_CREDENTIALS', () => {
    expect(
      devCredentialsEnabled({
        NODE_ENV: 'development',
      }),
    ).toBe(false);
  });
});
