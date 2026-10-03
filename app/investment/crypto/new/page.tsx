import { CryptoTransactionForm } from '@/components/crypto/crypto-transaction-form';

export const metadata = {
  title: 'Nueva Transacción Cripto | FinanzApp',
  description: 'Registra una nueva transacción de criptomonedas',
};

export default function NewCryptoTransactionPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <CryptoTransactionForm />
    </div>
  );
}
