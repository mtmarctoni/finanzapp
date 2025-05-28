'use client'

import RecurringRecords from "@/components/recurring-records"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Toaster } from "@/components/ui/toaster"

export default function RecurringRecordsPage() {
  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <Toaster />
      <Card className="mx-2 sm:mx-4 md:mx-6 lg:mx-auto lg:max-w-7xl">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle>Registros Recurrentes</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-4">
          <div className="w-full">
            <div className="w-full">
              <RecurringRecords />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
