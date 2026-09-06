'use client';

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn, formatCurrency } from '@/lib/utils';
import { type PaginatedEntriesResponse } from '@/types/api';

const ITEMS_PER_PAGE = 10;

type SortField = 'fecha' | 'que' | 'accion' | 'plataforma_pago' | 'cantidad';

interface SortableColumn {
  field: SortField;
  label: string;
  className?: string;
}

const COLUMNS: SortableColumn[] = [
  { field: 'fecha', label: 'Fecha' },
  { field: 'que', label: 'Que' },
  { field: 'accion', label: 'Acción' },
  { field: 'plataforma_pago', label: 'Plataforma' },
  { field: 'cantidad', label: 'Importe', className: 'text-right' },
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

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>Movimientos por Tipo</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {data.totalItems} movimientos en{' '}
            <span className="font-semibold">{tipo}</span>
          </p>
        </div>
        {error && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchEntries()}
          >
            Reintentar
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
            <p>{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchEntries()}
            >
              Reintentar
            </Button>
          </div>
        ) : data.data.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {COLUMNS.map((col) => (
                      <TableHead
                        key={col.field}
                        className={cn(
                          col.className,
                          col.field === 'cantidad' && 'text-right',
                        )}
                      >
                        <button
                          type="button"
                          className={cn(
                            'inline-flex items-center gap-1 uppercase tracking-wide',
                            sortBy === col.field
                              ? 'text-foreground font-semibold'
                              : 'font-medium',
                          )}
                          onClick={() => handleSort(col.field)}
                          aria-label={`Ordenar por ${col.label}`}
                        >
                          {col.label}
                          {sortBy === col.field && (
                            <span aria-hidden>
                              {sortOrder === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </button>
                      </TableHead>
                    ))}
                    <TableHead className="hidden sm:table-cell">
                      Detalle
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((entry) => {
                    const isIncome = entry.accion === 'Ingreso';
                    const isInvestment = entry.accion === 'Inversión';
                    const amount = Math.abs(Number(entry.cantidad));
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(entry.fecha).toLocaleDateString('es-ES')}
                        </TableCell>
                        <TableCell className="font-medium">
                          {entry.que}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                              isIncome
                                ? 'bg-green-100 text-green-700'
                                : isInvestment
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-red-100 text-red-700',
                            )}
                          >
                            {isIncome ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {entry.accion}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.plataforma_pago}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-semibold',
                            isIncome
                              ? 'text-green-600'
                              : isInvestment
                                ? 'text-blue-600'
                                : 'text-destructive',
                          )}
                        >
                          {isIncome ? '+' : '-'}
                          {formatCurrency(amount)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                          {entry.detalle1 ?? entry.detalle2 ?? '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-center space-x-2 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => goToPage(1)}
                  aria-label="Primera página"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => goToPage(currentPage - 1)}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Página {currentPage} de {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= data.totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= data.totalPages}
                  onClick={() => goToPage(data.totalPages)}
                  aria-label="Última página"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            No hay datos
          </div>
        )}
      </CardContent>
    </Card>
  );
}
