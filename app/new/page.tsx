"use client"

import { useSearchParams } from "next/navigation"
import { FinanceForm } from "@/components/finance-form"
import { Suspense } from "react"

function NewEntryContent() {
  const searchParams = useSearchParams()
  
  // Check if we have AI-parsed data from query params
  const hasAiData = searchParams.has("ai_text")
  
  // Build parsedData object from query params if AI data exists
  const parsedData = hasAiData ? {
    fecha: searchParams.get("fecha") || undefined,
    hora: searchParams.get("hora") ? parseInt(searchParams.get("hora")!, 10) : undefined,
    minuto: searchParams.get("minuto") ? parseInt(searchParams.get("minuto")!, 10) : undefined,
    tipo: searchParams.get("tipo") || undefined,
    accion: searchParams.get("accion") || undefined,
    que: searchParams.get("que") || undefined,
    plataforma_pago: searchParams.get("plataforma_pago") || undefined,
    cantidad: searchParams.get("cantidad") ? parseFloat(searchParams.get("cantidad")!) : undefined,
    detalle1: searchParams.get("detalle1") || undefined,
    detalle2: searchParams.get("detalle2") || undefined,
    ai_text: searchParams.get("ai_text") || undefined,
    ai_provider: searchParams.get("ai_provider") || undefined,
    ai_model: searchParams.get("ai_model") || undefined,
    ai_cost: searchParams.get("ai_cost") ? parseFloat(searchParams.get("ai_cost")!) : undefined,
    ai_paid: searchParams.get("ai_paid") === "true",
  } : undefined

  return (
    <main className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">
        {hasAiData ? "Revisar Entrada (IA)" : "Añadir Nueva Entrada"}
      </h1>
      <FinanceForm parsedData={parsedData} />
    </main>
  )
}

export default function NewEntryPage() {
  return (
    <Suspense fallback={<div className="container mx-auto py-10">Cargando...</div>}>
      <NewEntryContent />
    </Suspense>
  )
}
