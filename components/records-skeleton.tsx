import { Skeleton } from '@/components/ui/skeleton';

export function RecordsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="border-t pt-6">
        <Skeleton className="h-5 w-40 mb-4" />
        <Skeleton className="h-10 w-full mb-4" />
      </div>
      <div className="rounded-md border">
        <div className="p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
