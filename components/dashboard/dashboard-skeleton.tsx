import { Skeleton } from '@/components/ui/skeleton';

/** Header placeholder with the same box as PageHeader. */
export function DashboardHeaderSkeleton() {
  return (
    <div className="flex min-h-14 items-end justify-between gap-3 pb-4 pt-4 md:pt-8">
      <div>
        <Skeleton className="mb-2 h-[14px] w-36 rounded-md" />
        <Skeleton className="h-[35px] w-44 rounded-lg" />
      </div>
      <Skeleton className="h-9 w-32 rounded-full" />
    </div>
  );
}

function SectionSkeleton({ rows }: { rows: number }) {
  return (
    <section>
      <div className="mb-3 flex h-6 items-center justify-between">
        <Skeleton className="h-4 w-40 rounded-md" />
        <Skeleton className="h-4 w-14 rounded-md" />
      </div>
      <div className="rounded-[20px] border border-hairline bg-surface px-4">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="flex h-16 items-center gap-3 border-hairline [&:not(:first-child)]:border-t"
          >
            <Skeleton className="h-10 w-10 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/5 rounded-md" />
              <Skeleton className="h-3 w-1/4 rounded-md" />
            </div>
            <Skeleton className="h-3.5 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Body placeholder that mirrors the final dashboard layout box for box. */
export function DashboardBodySkeleton() {
  return (
    <div
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:grid-rows-[auto_1fr] lg:gap-x-10"
      aria-busy
      aria-label="Cargando resumen"
    >
      <div className="space-y-4 lg:col-start-1 lg:row-start-1">
        <div className="pt-1">
          <Skeleton className="h-[15px] w-32 rounded-md" />
          <Skeleton className="mt-4 h-16 w-64 rounded-2xl md:h-[52px]" />
          <Skeleton className="mt-4 h-[15px] w-56 rounded-md" />
        </div>
        <div className="grid grid-cols-2 rounded-[20px] border border-hairline bg-surface py-3.5">
          {[0, 1].map((i) => (
            <div
              key={i}
              className={i > 0 ? 'border-l border-hairline px-3.5' : 'px-3.5'}
            >
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="mt-2.5 h-5 w-24 rounded-md" />
              <Skeleton className="mt-1.5 h-3 w-12 rounded-md" />
            </div>
          ))}
        </div>
        <div className="rounded-[20px] border border-hairline bg-surface p-5">
          <Skeleton className="h-3.5 w-28 rounded-md" />
          <Skeleton className="mt-3 h-7 w-36 rounded-md" />
          <Skeleton className="mt-2 h-3.5 w-48 rounded-md" />
          <div className="mt-4 flex h-[92px] items-end gap-2 lg:h-32">
            {[40, 55, 35, 70, 50, 85].map((h) => (
              <Skeleton
                key={h}
                className="flex-1 rounded-[6px]"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="mt-2 h-[18px]" />
        </div>
      </div>
      <div className="space-y-8 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <SectionSkeleton rows={5} />
        <SectionSkeleton rows={5} />
      </div>
      <div className="h-14 self-start rounded-[20px] border border-hairline bg-surface lg:col-start-1 lg:row-start-2" />
    </div>
  );
}
