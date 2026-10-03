'use client';

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ChartLoading, EmptyState, Section } from '@/components/analytics/kit';
import { RECORD_COLUMNS, RecordRow } from '@/components/analytics/record-rows';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type PaginatedEntriesResponse } from '@/types/api';

const ITEMS_PER_PAGE = 10;

type SortField = 'fecha' | 'que' | 'accion' | 'plataforma_pago' | 'cantidad';

interface SortableColumn {
  field: SortField;
  label: string;
  className?: string;
}

// Same order as the RECORD_COLUMNS grid so the header doubles as the table
// head on desktop and a sort rail on mobile.
const COLUMNS: SortableColumn[] = [
  { field: 'que', label: 'Que', className: 'md:pl-[52px]' },
  { field: 'accion', label: 'Acción' },
  { field: 'plataforma_pago', label: 'Plataforma' },
  { field: 'fecha', label: 'Fecha' },
  { field: 'cantidad', label: 'Importe', className: 'md:justify-self-end' },
];

interface TipoEntriesTableProps {
  tipo: string;
  que?: string;
  accion?: string;
  from?: string;
  to?: string;
}

export function TipoEntriesTable({
  tipo,
  que,
  accion,
  from,
  to,
}: TipoEntriesTableProps) {
  const [data, setData] = useState<PaginatedEntriesResponse>({
    data: [],
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(ITEMS_PER_PAGE);
  const [sortBy, setSortBy] = useState<SortField>('fecha');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const prevQuery = useRef<string>('');
  const query = JSON.stringify({ tipo, que, accion, from, to });

  // Reset pagination and sorting when any filter changes
  useEffect(() => {
    if (prevQuery.current !== '' && prevQuery.current !== query) {
      setCurrentPage(1);
      setSortBy('fecha');
      setSortOrder('desc');
    }
    prevQuery.current = query;
  }, [query]);

  const fetchEntries = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          tipo,
          page: String(currentPage),
          itemsPerPage: String(pageSize),
          sortBy,
          sortOrder,
        });
        if (que) params.set('que', que);
        if (accion && accion !== 'todos') params.set('accion', accion);
        if (from) params.set('from', from);
        if (to) params.set('to', to);

        const res = await fetch(`/api/entries?${params.toString()}`, {
          signal,
        });
        if (!res.ok) throw new Error('Error al cargar movimientos');
        const result = (await res.json()) as PaginatedEntriesResponse;
        setData(result);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError('No se pudieron cargar los movimientos');
      } finally {
        setLoading(false);
      }
    },
    [tipo, que, accion, from, to, currentPage, pageSize, sortBy, sortOrder],
  );

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-filter-change drives the request's own loading/error state
    void fetchEntries(controller.signal);
    return () => controller.abort();
  }, [fetchEntries]);

  const handleSort = (field: SortField) => {
    setSortOrder((prev) =>
      sortBy === field && prev === 'desc' ? 'asc' : 'desc',
    );
    setSortBy(field);
  };

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, data.totalPages || 1)));
  };

  const SortIcon = sortOrder === 'asc' ? ArrowUp : ArrowDown;

  return (
    <Section
      title="Movimientos por tipo"
      description={
        <span className="num">
          {data.totalItems} movimientos en{' '}
          <span className="font-semibold text-foreground">{tipo}</span>
        </span>
      }
      action={
        error && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void fetchEntries()}
          >
            Reintentar
          </Button>
        )
      }
    >
      <div
        role="group"
        aria-label="Ordenar movimientos"
        className={cn(
          'no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-3 md:mx-0 md:overflow-visible md:border-b md:border-hairline md:px-0 md:pb-2',
          RECORD_COLUMNS,
        )}
      >
        {COLUMNS.map((col) => {
          const active = sortBy === col.field;
          return (
            <button
              key={col.field}
              type="button"
              onClick={() => handleSort(col.field)}
              aria-label={`Ordenar por ${col.label}`}
              aria-pressed={active}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-[13px] font-semibold transition-colors',
                active
                  ? 'bg-foreground text-background'
                  : 'bg-surface-2 text-subtle hover:text-foreground',
                'md:h-auto md:rounded-none md:bg-transparent md:px-0 md:text-[11px] md:font-medium md:uppercase md:tracking-wide',
                active ? 'md:text-foreground' : 'md:text-faint',
                col.className,
              )}
            >
              {col.label}
              {active && <SortIcon aria-hidden className="h-3 w-3" />}
            </button>
          );
        })}
      </div>

      {loading ? (
        <ChartLoading className="mt-2 h-64" />
      ) : error ? (
        <EmptyState className="min-h-48">
          <div className="space-y-3">
            <p>{error}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void fetchEntries()}
            >
              Reintentar
            </Button>
          </div>
        </EmptyState>
      ) : data.data.length > 0 ? (
        <>
          <ul aria-label={`Movimientos en ${tipo}`}>
            {data.data.map((entry, i) => (
              <RecordRow
                key={entry.id}
                first={i === 0}
                name={entry.que}
                sub={[entry.accion, entry.plataforma_pago]
                  .filter(Boolean)
                  .join(' · ')}
                detail={entry.detalle1 ?? entry.detalle2}
                action={entry.accion}
                platform={entry.plataforma_pago}
                date={entry.fecha}
                amount={Number(entry.cantidad)}
              />
            ))}
          </ul>

          {data.totalPages > 1 && (
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-hairline pt-3">
              <Button
                variant="secondary"
                size="icon"
                disabled={currentPage <= 1}
                onClick={() => goToPage(currentPage - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="num text-[13px] text-subtle">
                Página {currentPage} de {data.totalPages}
              </span>
              <Button
                variant="secondary"
                size="icon"
                disabled={currentPage >= data.totalPages}
                onClick={() => goToPage(currentPage + 1)}
                aria-label="Página siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      ) : (
        <EmptyState>No hay datos</EmptyState>
      )}
    </Section>
  );
}
