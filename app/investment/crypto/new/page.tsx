import { CryptoTransactionForm } from "@/components/crypto/crypto-transaction-form"

export const metadata = {
  title: "Nueva Transacción Cripto | FinanzApp",
  description: "Registra una nueva transacción de criptomonedas",
}

export default function NewCryptoTransactionPage() {
  return (
    <div className="container mx-auto py-6 max-w-2xl">
      <CryptoTransactionForm />
    </div>
  )
}
