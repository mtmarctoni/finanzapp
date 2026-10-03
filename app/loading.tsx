import { Skeleton } from '@/components/ui/skeleton';

/** Route-level placeholder: page title, one hero card and a list. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando" className="animate-fade-in">
      <div className="pb-4 pt-4 md:pt-8">
        <Skeleton className="mb-2 h-3.5 w-20 rounded-md" />
        <Skeleton className="h-9 w-44 rounded-lg" />
      </div>
      <div className="space-y-3">
        <div className="rounded-[20px] border border-hairline bg-surface p-5">
          <Skeleton className="h-3.5 w-28 rounded-md" />
          <Skeleton className="mt-4 h-11 w-48 rounded-lg" />
          <Skeleton className="mt-4 h-3 w-36 rounded-md" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-[20px]" />
          <Skeleton className="h-24 rounded-[20px]" />
        </div>
        <div className="rounded-[20px] border border-hairline bg-surface px-4">
          {[0, 1, 2, 3].map((row) => (
            <div
              key={row}
              className="flex h-16 items-center gap-3 border-t border-hairline first:border-t-0"
            >
              <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/5 rounded-md" />
                <Skeleton className="h-3 w-3/5 rounded-md" />
              </div>
              <Skeleton className="h-3.5 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
