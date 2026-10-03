import { Skeleton } from '@/components/ui/skeleton';

/** Route-level fallback shared by the /analytics pages. */
export function AnalyticsSkeleton() {
  return (
    <div className="min-w-0" aria-busy="true" aria-label="Cargando análisis">
      <div className="flex items-end justify-between pb-4 pt-4 md:pt-8">
        <Skeleton className="h-9 w-40 rounded-xl" />
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-24 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-10 w-28 rounded-full" />
      <div className="mt-5 grid gap-3 lg:grid-cols-4">
        <Skeleton className="h-[264px] rounded-[20px] lg:col-span-2" />
        <div className="grid grid-cols-2 gap-3 lg:col-span-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[120px] rounded-[20px]" />
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-[20px]" />
        <Skeleton className="h-80 rounded-[20px]" />
      </div>
    </div>
  );
}
