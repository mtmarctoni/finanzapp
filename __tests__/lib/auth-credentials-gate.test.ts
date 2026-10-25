/**
 * Regression tests for the credentials provider gate.
 *
 * The Credentials provider is intentionally restricted: it is only enabled
 * when DEV_CREDENTIALS is set AND the app runs locally (NODE_ENV !==
 * 'production') or on a Vercel preview deployment (VERCEL_ENV ===
 * 'preview'). Production remains hard-gated.
 *
 * Exercise the shared implementation used by auth and demo metadata.
 */

import { credentialsEnabled as devCredentialsEnabled } from '@/lib/auth-credentials';

describe('devCredentialsEnabled (credentials provider gate)', () => {
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
