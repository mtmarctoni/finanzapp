'use client';

import { Plus, ReceiptText, SearchX } from 'lucide-react';
import Link from 'next/link';

import { useQuickAdd } from '@/components/quick-add/quick-add-context';
import { Button } from '@/components/ui/button';

/**
 * Empty state for the records page. With filters applied it offers to clear
 * them; with no records at all it opens the quick-add sheet.
 */
export function RecordsEmpty({ filtered }: { filtered: boolean }) {
  const { open } = useQuickAdd();
  const Icon = filtered ? SearchX : ReceiptText;
  return (
    <div className="flex flex-col items-center rounded-[20px] border border-hairline bg-surface px-6 py-14 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-subtle">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <h2 className="mt-5 text-[17px] font-semibold tracking-[-0.02em]">
        {filtered ? 'Sin resultados' : 'Aún no hay registros'}
      </h2>
      <p className="mt-1.5 max-w-[30ch] text-[15px] text-subtle">
        {filtered
          ? 'Ningún registro coincide con la búsqueda o los filtros.'
          : 'No hay entradas. Añade una nueva entrada para comenzar.'}
      </p>
      {filtered ? (
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/records?page=1">Quitar filtros</Link>
        </Button>
      ) : (
        <Button variant="secondary" className="mt-6" onClick={open}>
          <Plus />
          Añadir registro
        </Button>
      )}
    </div>
  );
}
