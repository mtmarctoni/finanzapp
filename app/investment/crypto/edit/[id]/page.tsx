import { CryptoTransactionForm } from "@/components/crypto/crypto-transaction-form"
import { getCryptoTransactionById } from "@/lib/cryptoActions"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { notFound, redirect } from "next/navigation"

export const metadata = {
  title: "Editar Transacción Cripto | FinanzApp",
  description: "Edita una transacción de criptomonedas existente",
}

interface EditCryptoTransactionPageProps {
  params: Promise<{ id: string }>
}

export default async function EditCryptoTransactionPage({ params }: EditCryptoTransactionPageProps) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    redirect("/auth/signin")
  }

  const { id } = await params
  const transaction = await getCryptoTransactionById(id, { user: { id: session.user.id } })

  if (!transaction) {
    notFound()
  }

  return (
    <div className="container mx-auto py-6 max-w-2xl">
      <CryptoTransactionForm transaction={transaction} />
    </div>
  )
}
