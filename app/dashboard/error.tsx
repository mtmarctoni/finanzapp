'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Error al cargar el panel</h2>
      <p className="text-muted-foreground">{error.message}</p>
      <button
        onClick={() => reset()}
        className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm"
        aria-label="Reintentar cargar el panel"
      >
        Reintentar
      </button>
    </div>
  )
}

