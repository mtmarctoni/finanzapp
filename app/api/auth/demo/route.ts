import { getPublicDemo } from '@/lib/auth-credentials';

export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { demo: getPublicDemo() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
