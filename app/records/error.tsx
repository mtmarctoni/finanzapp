'use client';

import { RotateCcw, TriangleAlert } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <>
      <PageHeader title="Registros" />
      <div
        role="alert"
        className="flex flex-col items-center rounded-[20px] border border-hairline bg-surface px-6 py-14 text-center"
      >
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-negative">
          <TriangleAlert className="h-6 w-6" aria-hidden />
        </span>
        <h2 className="mt-5 text-[17px] font-semibold tracking-[-0.02em]">
          Error al cargar los registros
        </h2>
        <p className="mt-1.5 max-w-[36ch] text-[15px] text-subtle [overflow-wrap:anywhere]">
          {error.message || 'Algo ha fallado. Inténtalo de nuevo.'}
        </p>
        <Button
          variant="secondary"
          className="mt-6"
          onClick={() => reset()}
          aria-label="Reintentar cargar los registros"
        >
          <RotateCcw />
          Reintentar
        </Button>
      </div>
    </>
  );
}
