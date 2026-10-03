import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Placeholder matching the mobile record list: day headers + row cards. */
export function RecordListSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)} aria-hidden>
      {[3, 4, 2].map((rows, g) => (
        // eslint-disable-next-line react/no-array-index-key -- static placeholder list
        <div key={g}>
          <div className="flex items-center justify-between px-1 pb-3">
            <Skeleton className="h-3 w-12 rounded-md" />
            <Skeleton className="h-3 w-16 rounded-md" />
          </div>
          <div className="rounded-[20px] border border-hairline bg-surface px-4">
            {Array.from({ length: rows }).map((_, i) => (
              <div
                // eslint-disable-next-line react/no-array-index-key -- static placeholder list
                key={i}
                className="flex h-16 items-center gap-3 border-t border-hairline first:border-t-0"
              >
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/5 rounded-md" />
                  <Skeleton className="h-3 w-3/5 rounded-md" />
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <Skeleton className="h-3.5 w-16 rounded-md" />
                  <Skeleton className="h-3 w-9 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Body rows for the desktop table while it loads. */
export function TableRowsSkeleton({
  rows = 8,
  columns,
}: {
  rows?: number;
  columns: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        // eslint-disable-next-line react/no-array-index-key -- static placeholder list
        <tr key={i} className="border-b border-hairline" aria-hidden>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-4 rounded" />
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-7 w-7 rounded-[9px]" />
              <Skeleton className="h-3.5 w-32 rounded-md" />
            </div>
          </td>
          {Array.from({ length: columns - 2 }).map((__, c) => (
            // eslint-disable-next-line react/no-array-index-key -- static placeholder list
            <td key={c} className="px-4 py-3">
              <Skeleton className="h-3.5 w-16 rounded-md" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Desktop placeholder card, shaped like the records table. */
function DesktopTableSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[20px] border border-hairline bg-surface',
        className,
      )}
      aria-hidden
    >
      <div className="flex h-11 items-center gap-8 border-b border-hairline px-4">
        {[48, 64, 48, 56, 72, 48].map((w, i) => (
          // eslint-disable-next-line react/no-array-index-key -- static placeholder list
          <Skeleton key={i} className="h-2.5 rounded" style={{ width: w }} />
        ))}
      </div>
      <table className="w-full">
        <tbody>
          <TableRowsSkeleton columns={7} />
        </tbody>
      </table>
    </div>
  );
}

/** Responsive records placeholder: list on mobile, table on md+. */
export function TableSkeleton() {
  return (
    <>
      <RecordListSkeleton className="md:hidden" />
      <DesktopTableSkeleton className="hidden md:block" />
    </>
  );
}
