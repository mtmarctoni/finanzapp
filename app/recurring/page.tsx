'use client'

import RecurringRecords from "@/components/recurring-records"

export default function RecurringRecordsPage() {
  return (
    <main className="container mx-auto py-8 space-y-2">
      <h1 className="text-3xl font-bold">Registros Recurrentes</h1>
      <p className="text-muted-foreground">
        Visualiza rápidamente qué se genera cada mes, explora detalles al pasar el cursor y edita solo cuando lo necesites.
      </p>
      <RecurringRecords />
    </main>
  )
}
