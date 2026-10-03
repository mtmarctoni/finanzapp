import { Suspense } from 'react';

import { AnalyticsSkeleton } from '@/components/analytics/analytics-skeleton';
import AnalyticsPageContent from '@/components/analytics-page-content';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <AnalyticsPageContent />
    </Suspense>
  );
}
