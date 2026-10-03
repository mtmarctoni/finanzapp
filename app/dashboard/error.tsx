'use client';

import { CircleAlert, RotateCw } from 'lucide-react';

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
      <PageHeader title="Inicio" />
      <div className="flex flex-col items-center gap-3 rounded-[20px] border border-hairline bg-surface px-6 py-10 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-negative/15 text-negative">
          <CircleAlert className="h-5 w-5" />
        </span>
        <div className="space-y-1">
          <h2 className="text-[17px] font-semibold tracking-[-0.02em]">
            No se pudo cargar el resumen
          </h2>
          <p className="text-[13px] text-subtle">{error.message}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => reset()}
          aria-label="Reintentar cargar el panel"
        >
          <RotateCw className="h-4 w-4" />
          Reintentar
        </Button>
      </div>
    </>
  );
}
