/**
 * @jest-environment node
 */
import path from 'node:path';

import type { NextConfig } from 'next';

// Loaded by runtime path so next.config.mjs stays out of the TypeScript
// project, where ESLint's allowDefaultProject already lints it.
const configPath = path.join(process.cwd(), 'next.config.mjs');

async function headerMap(): Promise<Map<string, string>> {
  const { default: nextConfig } = (await import(configPath)) as {
    default: NextConfig;
  };
  const rules = await nextConfig.headers?.();
  const all = rules?.find((rule) => rule.source === '/:path*');
  return new Map(all?.headers.map(({ key, value }) => [key, value]) ?? []);
}

describe('security headers', () => {
  it('applies the security headers to every route', async () => {
    const headers = await headerMap();

    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(headers.get('Strict-Transport-Security')).toMatch(/max-age=\d+/);
  });

  it('sends a CSP that forbids framing and plugins', async () => {
    const csp = (await headerMap()).get('Content-Security-Policy') ?? '';

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });
});
