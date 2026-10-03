import { Suspense } from 'react';

import { AnalyticsSkeleton } from '@/components/analytics/analytics-skeleton';
import TipoPageContent from '@/components/analytics/tipo-page-content';

export const dynamic = 'force-dynamic';

export default async function AnalyticsTipoPage() {
  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <TipoPageContent />
    </Suspense>
  );
}
