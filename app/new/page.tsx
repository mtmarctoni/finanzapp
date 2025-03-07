import { FinanceForm } from "@/components/finance-form"

export default function NewEntryPage() {
  return (
    <main className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Añadir Nueva Entrada</h1>
      <FinanceForm />
    </main>
  )
}

