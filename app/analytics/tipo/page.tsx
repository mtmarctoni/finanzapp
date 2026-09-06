import { Suspense } from 'react';

import TipoPageContent from '@/components/analytics/tipo-page-content';

export const dynamic = 'force-dynamic';

export default async function AnalyticsTipoPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-4 space-y-6">
          <div className="h-8 w-64 bg-muted animate-pulse rounded-lg mb-6" />
          <div className="flex gap-2 mb-6">
            <div className="h-10 w-28 bg-muted animate-pulse rounded-lg" />
            <div className="h-10 w-28 bg-muted animate-pulse rounded-lg" />
            <div className="h-10 w-28 bg-muted animate-pulse rounded-lg" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="h-24 bg-muted animate-pulse rounded-lg" />
            <div className="h-24 bg-muted animate-pulse rounded-lg" />
            <div className="h-24 bg-muted animate-pulse rounded-lg" />
            <div className="h-24 bg-muted animate-pulse rounded-lg" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-[300px] bg-muted animate-pulse rounded-lg" />
            <div className="h-[300px] bg-muted animate-pulse rounded-lg" />
            <div className="h-[300px] bg-muted animate-pulse rounded-lg" />
            <div className="h-[300px] bg-muted animate-pulse rounded-lg" />
          </div>
          <div className="h-[400px] bg-muted animate-pulse rounded-lg" />
        </div>
      }
    >
      <TipoPageContent />
    </Suspense>
  );
}
