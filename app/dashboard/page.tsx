import { Suspense } from "react"
import Dashboard from "@/components/dashboard"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  return (
    <main className="container mx-auto py-10 space-y-6">
      <div className="flex flex-wrap justify-between items-center">
        <h1 className="text-3xl font-bold">Panel de Control</h1>
      </div>
      <Suspense fallback={<div className="h-[120px] rounded-lg bg-muted animate-pulse" />}>
        <Dashboard />
      </Suspense>
    </main>
  )
}

