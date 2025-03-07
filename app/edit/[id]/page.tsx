import { FinanceForm } from "@/components/finance-form"
import { getEntryById } from "@/lib/data"
import { notFound } from "next/navigation"

export default async function EditEntryPage({ params }: { params: { id: string } }) {
  const entry = await getEntryById(params.id)

  if (!entry) {
    notFound()
  }

  return (
    <main className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Editar Entrada</h1>
      <FinanceForm entry={entry} />
    </main>
  )
}

