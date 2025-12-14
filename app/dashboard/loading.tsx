export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 rounded bg-muted animate-pulse" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="h-28 rounded bg-muted animate-pulse" />
        <div className="h-28 rounded bg-muted animate-pulse" />
        <div className="h-28 rounded bg-muted animate-pulse" />
        <div className="h-28 rounded bg-muted animate-pulse" />
      </div>
      <div className="h-64 rounded bg-muted animate-pulse" />
    </div>
  )
}

