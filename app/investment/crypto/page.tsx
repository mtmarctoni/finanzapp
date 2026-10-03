import { Suspense } from 'react';

import {
  CryptoFormSheet,
  NewCryptoButton,
} from '@/components/crypto/crypto-form-sheet';
import { CryptoOverview } from '@/components/crypto/crypto-overview';
import { CryptoSearchFilter } from '@/components/crypto/crypto-search-filter';
import CryptoTransactionTable from '@/components/crypto/crypto-transaction-table';
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'Cripto | FinanzApp',
  description: 'Gestiona tus transacciones de criptomonedas',
};

interface CryptoPageProps {
  searchParams: Promise<{
    search?: string;
    transactionType?: string;
    cryptoSymbol?: string;
    from?: string;
    to?: string;
    page?: string;
    itemsPerPage?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export default async function CryptoPage({ searchParams }: CryptoPageProps) {
  const params = await searchParams;

  return (
    <>
      <PageHeader
        title="Cripto"
        eyebrow="Cartera"
        actions={<NewCryptoButton />}
      />

      <div className="space-y-8">
        <Suspense
          fallback={<Skeleton className="h-96 w-full rounded-[20px]" />}
        >
          <CryptoOverview />
        </Suspense>

        <div className="space-y-4">
          <Suspense
            fallback={<Skeleton className="h-24 w-full rounded-[20px]" />}
          >
            <CryptoSearchFilter />
          </Suspense>

          <Suspense
            fallback={<Skeleton className="h-96 w-full rounded-[20px]" />}
          >
            <CryptoTransactionTable searchParams={params} />
          </Suspense>
        </div>
      </div>

      <CryptoFormSheet />
    </>
  );
}
