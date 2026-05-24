import { Suspense } from 'react';
import AnalyticsPageContent from '@/components/analytics-page-content';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-4 space-y-6">
          <div className="h-8 w-64 bg-muted animate-pulse rounded-lg mb-6" />
          <div className="flex gap-2 mb-6">
            <div className="h-10 w-40 bg-muted animate-pulse rounded-lg" />
            <div className="h-10 w-40 bg-muted animate-pulse rounded-lg" />
            <div className="h-10 w-40 bg-muted animate-pulse rounded-lg" />
            <div className="h-10 w-32 bg-muted animate-pulse rounded-lg" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-[300px] bg-muted animate-pulse rounded-lg" />
            <div className="h-[300px] bg-muted animate-pulse rounded-lg" />
            <div className="h-[300px] bg-muted animate-pulse rounded-lg" />
            <div className="h-[300px] bg-muted animate-pulse rounded-lg" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-[300px] bg-muted animate-pulse rounded-lg" />
            <div className="h-[300px] bg-muted animate-pulse rounded-lg" />
          </div>
          <div className="h-[400px] bg-muted animate-pulse rounded-lg" />
        </div>
      }
    >
      <AnalyticsPageContent />
    </Suspense>
  );
}
