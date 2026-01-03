export default function CryptoLoading() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="h-9 w-64 bg-muted animate-pulse rounded" />
          <div className="h-5 w-96 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-10 w-40 bg-muted animate-pulse rounded" />
      </div>
      
      <div className="h-20 w-full bg-muted animate-pulse rounded" />
      
      <div className="h-96 w-full bg-muted animate-pulse rounded" />
    </div>
  )
}
