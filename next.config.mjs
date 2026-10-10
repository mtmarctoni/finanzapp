const isDev = process.env.NODE_ENV === 'development';

// Derive the canonical site URL on per-deployment environments (e.g. Vercel
// previews), where NEXTAUTH_URL is unset. This keeps NextAuth's redirect and
// callback URLs on the deployment host and lets the __Secure- session cookie
// be detected over https. NEXTAUTH_URL is a public value, so it is safe to
// surface through `env` below.
if (!process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

// Baseline Content-Security-Policy. Next.js injects inline bootstrap scripts
// and styles, so 'unsafe-inline' is needed until nonces are wired up; the
// dev server additionally needs 'unsafe-eval' for React Refresh. Images allow
// any https origin because OAuth avatars come from the provider's CDN.
// form-action is left unset on purpose: the NextAuth sign-in form redirects
// to the OAuth provider, which a 'self' form-action would block.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // NOTE: Do NOT add server-only secrets here.
  // Anything declared under `env` is inlined into the client bundle at build
  // time and becomes publicly visible. Only safe public values may live here,
  // and even those should normally use the `NEXT_PUBLIC_` convention so they
  // are surfaced through `process.env.NEXT_PUBLIC_*` automatically.
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
  typescript: {
    // TODO(security): a number of pre-existing type errors live in
    // components/finance-form.tsx, components/ui/calendar.tsx, and
    // components/monthly-trends-chart.tsx. They are tracked separately
    // and need to be fixed so this flag can flip to false. Until then,
    // CI must still run `pnpm exec tsc --noEmit` so the errors don't
    // grow silently — see the verification step in CONTRIBUTING.
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
  },
};

export default nextConfig;
