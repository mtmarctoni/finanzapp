import { Skeleton } from '@/components/ui/skeleton';

export default function CryptoLoading() {
  return (
    <div aria-busy="true" aria-label="Cargando cartera">
      <div className="pb-4 pt-4 md:pt-8">
        <Skeleton className="mb-2 h-4 w-16 rounded-md" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-[168px] w-full rounded-[20px]" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-[20px]" />
          <Skeleton className="h-24 rounded-[20px]" />
        </div>
        <Skeleton className="h-64 w-full rounded-[20px]" />
      </div>
    </div>
  );
}
