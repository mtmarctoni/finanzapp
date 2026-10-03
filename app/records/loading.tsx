import { TableSkeleton } from '@/components/table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando registros">
      <div className="flex min-h-14 items-end justify-between pb-4 pt-4 md:pt-8">
        <Skeleton className="h-9 w-44 rounded-xl" />
        <Skeleton className="h-11 w-11 rounded-full" />
      </div>
      <div className="flex flex-col gap-3 pb-3 pt-2 md:pb-6 md:pt-0">
        <Skeleton className="h-11 w-full md:max-w-md" />
        <div className="flex gap-2 overflow-hidden">
          {[64, 72, 80, 96, 76].map((w) => (
            <Skeleton
              key={w}
              className="h-9 shrink-0 rounded-full"
              style={{ width: w }}
            />
          ))}
        </div>
      </div>
      <div className="pt-5 md:pt-0">
        <TableSkeleton />
      </div>
    </div>
  );
}
