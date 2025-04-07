'use client'

import RecurringRecords from "@/components/recurring-records"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Toaster } from "@/components/ui/toaster"

export default function RecurringRecordsPage() {
  return (
    <div className="space-y-6">
      <Toaster />
      <Card>
        <CardHeader>
          <CardTitle>Registros Recurrentes</CardTitle>
        </CardHeader>
        <CardContent>
          <RecurringRecords />
        </CardContent>
      </Card>
    </div>
  )
}
