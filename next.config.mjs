/** @type {import('next').NextConfig} */
const nextConfig = {
  // NOTE: Do NOT add server-only secrets here.
  // Anything declared under `env` is inlined into the client bundle at build
  // time and becomes publicly visible. Only safe public values may live here,
  // and even those should normally use the `NEXT_PUBLIC_` convention so they
  // are surfaced through `process.env.NEXT_PUBLIC_*` automatically.
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
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
