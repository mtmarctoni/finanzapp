'use client';

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState, useTransition } from 'react';

import { CategoryTile } from '@/components/quick-add/category-icon';
import { RecordAmount } from '@/components/records/record-amount';
import { RecordDetailSheet } from '@/components/records/record-detail-sheet';
import {
  amountOf,
  flowOf,
  shortDate,
} from '@/components/records/record-format';
import { RecordList } from '@/components/records/record-list';
import { RecordsEmpty } from '@/components/records/records-empty';
import { useIsDesktop } from '@/components/records/use-is-desktop';
import {
  RecordListSkeleton,
  TableRowsSkeleton,
  TableSkeleton,
} from '@/components/table-skeleton';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DEFAULT_ACCION_FILTER,
  DEFAULT_SORT_BY,
  DEFAULT_SORT_ORDER,
  ITEMS_PER_PAGE,
} from '@/config';
import { useToast } from '@/hooks/use-toast';
import { deleteEntry, deleteManyEntries } from '@/lib/actions';
import { duplicateEntry, getFinanceEntries } from '@/lib/data';
import { cn, formatCurrency, shouldSplitTransaction } from '@/lib/utils';
import { type PaginatedEntriesResponse } from '@/types/api';
import type { Entry } from '@/types/finance';

type SortField =
  | 'fecha'
  | 'accion'
  | 'que'
  | 'tipo'
  | 'plataforma_pago'
  | 'cantidad'
  | 'quien';

type SearchParams = {
  search?: string;
  accion?: string;
  from?: string;
  to?: string;
  page?: string;
  itemsPerPage?: string;
  sortBy?: string;
  sortOrder?: string;
};

const FLOW_DOT: Record<ReturnType<typeof flowOf>, string> = {
  income: 'bg-positive',
  expense: 'bg-faint',
  invest: 'bg-invest',
};

function toResponse(
  result: PaginatedEntriesResponse,
): PaginatedEntriesResponse {
  return {
    data: result.data,
    totalItems: (result.totalItems ||
      ((result as { total?: number }).total ?? 0)) as number,
    totalPages: result.totalPages,
    currentPage: result.currentPage,
  };
}

export default function FinanceTable({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const isDesktop = useIsDesktop();

  const [entries, setEntries] = useState<PaginatedEntriesResponse>({
    data: [],
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
  });
  const [loaded, setLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detail, setDetail] = useState<Entry | null>(null);

  const search = searchParams?.search ?? '';
  const accion =
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty URL param must fall back to 'todos'
    searchParams?.accion || DEFAULT_ACCION_FILTER;
  const from = searchParams?.from ?? '';
  const to = searchParams?.to ?? '';
  const currentPage = Number(searchParams?.page) || 1;
  const itemsPerPage = Number(searchParams?.itemsPerPage) || ITEMS_PER_PAGE;
  const [sortBy, setSortBy] = useState<SortField>(
    (searchParams?.sortBy as SortField | undefined) ?? DEFAULT_SORT_BY,
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    (searchParams?.sortOrder as 'asc' | 'desc' | undefined) ??
      DEFAULT_SORT_ORDER,
  );
  const filtered = Boolean(search || from || to || accion !== 'todos');

  const fetchEntries = useCallback(
    async () =>
      toResponse(
        (await getFinanceEntries({
          search,
          accion,
          from,
          to,
          page: currentPage,
          itemsPerPage,
          sortBy,
          sortOrder,
        })) as PaginatedEntriesResponse,
      ),
    [search, accion, from, to, currentPage, itemsPerPage, sortBy, sortOrder],
  );

  useEffect(() => {
    let cancelled = false;
    void fetchEntries().then((result) => {
      if (cancelled) return;
      setEntries(result);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchEntries]);

  const allSelected =
    entries.data.length > 0 && selectedIds.length === entries.data.length;

  const toggleAll = () =>
    setSelectedIds(allSelected ? [] : entries.data.map((e) => e.id));

  const toggleOne = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );

  const pushParams = (mutate: (p: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams as Record<string, string>);
    mutate(params);
    router.push(`/records?${params.toString()}`);
  };

  const handleSort = (field: SortField) => {
    const nextOrder = sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortBy(field);
    setSortOrder(nextOrder);
    pushParams((p) => {
      p.set('sortBy', field);
      p.set('sortOrder', nextOrder);
    });
  };

  const goToPage = (page: number) =>
    pushParams((p) => {
      p.set('page', String(page));
      p.set('itemsPerPage', String(itemsPerPage));
    });

  const handleDelete = (id: string) => {
    const formData = new FormData();
    formData.set('entryId', id);
    startTransition(async () => {
      // Optimistic: drop the row first, then delete on the server.
      setEntries((prev) => ({
        ...prev,
        data: prev.data.filter((item) => item.id !== id),
        totalItems: Math.max(0, prev.totalItems - 1),
      }));
      setSelectedIds((prev) => prev.filter((i) => i !== id));
      setDetail(null);
      if (!session?.user.id) {
        throw new Error('User session not available');
      }
      await deleteEntry(formData, { user: { id: session.user.id } });
      toast({ title: 'Registro eliminado' });
    });
  };

  const handleDuplicate = (id: string) => {
    if (!session?.user.id) {
      toast({
        title: 'Debes iniciar sesión para duplicar entradas',
        variant: 'destructive',
      });
      return;
    }
    startTransition(async () => {
      try {
        await duplicateEntry(id);
        setEntries(await fetchEntries());
        setDetail(null);
        toast({ title: 'Registro duplicado' });
      } catch (error) {
        console.error('Error duplicando entrada:', error);
        toast({
          title: 'Error al duplicar la entrada',
          variant: 'destructive',
        });
      }
    });
  };

  const handleBulkDelete = (formData: FormData) => {
    startTransition(async () => {
      if (!session?.user.id) {
        toast({
          title: 'Debes iniciar sesión para eliminar entradas',
          variant: 'destructive',
        });
        return;
      }
      await deleteManyEntries(formData, { user: { id: session.user.id } });
      const count = selectedIds.length;
      setEntries((prev) => ({
        ...prev,
        data: prev.data.filter((e) => !selectedIds.includes(e.id)),
        totalItems: Math.max(0, prev.totalItems - count),
      }));
      setSelectedIds([]);
      toast({
        title:
          count === 1 ? 'Registro eliminado' : `${count} registros eliminados`,
      });
    });
  };

  if (isDesktop === null) return <TableSkeleton />;

  const sheet = (
    <RecordDetailSheet
      entry={detail}
      onOpenChange={(open) => !open && setDetail(null)}
      onDuplicate={handleDuplicate}
      onDelete={handleDelete}
      busy={isPending}
    />
  );

  const pagination =
    entries.totalPages > 1 ? (
      <Pagination
        page={currentPage}
        totalPages={entries.totalPages}
        totalItems={entries.totalItems}
        perPage={itemsPerPage}
        onPage={goToPage}
      />
    ) : null;

  if (!isDesktop) {
    if (!loaded) return <RecordListSkeleton />;
    return (
      <>
        {entries.data.length === 0 ? (
          <RecordsEmpty filtered={filtered} />
        ) : (
          <RecordList
            entries={entries.data}
            grouped={sortBy === 'fecha'}
            onOpen={setDetail}
          />
        )}
        {pagination && <div className="mt-6">{pagination}</div>}
        {sheet}
      </>
    );
  }

  const sortProps = { sortBy, sortOrder, onSort: handleSort };

  return (
    <>
      {loaded && entries.data.length === 0 ? (
        <RecordsEmpty filtered={filtered} />
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-hairline bg-surface">
          {selectedIds.length > 0 && (
            <div className="flex h-14 items-center justify-between gap-3 border-b border-hairline bg-surface-2 px-4 animate-in fade-in">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  aria-label="Deseleccionar todo"
                  className="grid h-8 w-8 place-items-center rounded-full text-subtle hover:bg-surface-3 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
                <span className="num text-[13px] font-medium">
                  {selectedIds.length} seleccionados
                </span>
              </div>
              <form action={handleBulkDelete}>
                <input type="hidden" name="ids" value={selectedIds.join(',')} />
                <Button
                  variant="destructive"
                  size="sm"
                  type="submit"
                  disabled={isPending || selectedIds.length === 0}
                  aria-label="Eliminar entradas seleccionadas"
                >
                  <Trash2 />
                  Eliminar seleccionados
                </Button>
              </form>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="h-11 w-12 pl-4 pr-0 text-left align-middle">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Seleccionar todas las filas"
                      className="border-hairline-strong"
                    />
                  </th>
                  <SortHead field="que" label="Qué" aria="qué" {...sortProps} />
                  <SortHead
                    field="tipo"
                    label="Tipo"
                    aria="tipo"
                    {...sortProps}
                  />
                  <SortHead
                    field="accion"
                    label="Accion"
                    aria="acción"
                    {...sortProps}
                  />
                  <SortHead
                    field="plataforma_pago"
                    label="Plataforma pago"
                    aria="plataforma pago"
                    {...sortProps}
                  />
                  <SortHead
                    field="quien"
                    label="Quién"
                    aria="quién pagó"
                    className="hidden xl:table-cell"
                    {...sortProps}
                  />
                  <PlainHead className="hidden 2xl:table-cell">
                    Detalle 1
                  </PlainHead>
                  <PlainHead className="hidden 2xl:table-cell">
                    Detalle 2
                  </PlainHead>
                  <SortHead
                    field="fecha"
                    label="Fecha"
                    aria="fecha"
                    {...sortProps}
                  />
                  <SortHead
                    field="cantidad"
                    label="Cantidad"
                    aria="cantidad"
                    align="right"
                    {...sortProps}
                  />
                  <PlainHead className="w-[124px] pr-4 text-right">
                    <span className="sr-only md:not-sr-only">Acciones</span>
                  </PlainHead>
                </tr>
              </thead>
              <tbody>
                {!loaded ? (
                  <TableRowsSkeleton columns={9} />
                ) : (
                  entries.data.map((entry) => (
                    <DesktopRow
                      key={entry.id}
                      entry={entry}
                      selected={selectedIds.includes(entry.id)}
                      busy={isPending}
                      onToggle={() => toggleOne(entry.id)}
                      onOpen={() => setDetail(entry)}
                      onEdit={() => router.push(`/edit/${entry.id}`)}
                      onDuplicate={() => handleDuplicate(entry.id)}
                      onDelete={() => handleDelete(entry.id)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          {pagination && (
            <div className="border-t border-hairline px-4 py-3">
              {pagination}
            </div>
          )}
        </div>
      )}
      {sheet}
    </>
  );
}

function PlainHead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        'h-11 whitespace-nowrap px-3 text-left align-middle text-xs font-semibold uppercase tracking-[0.04em] text-faint',
        className,
      )}
    >
      {children}
    </th>
  );
}

function SortHead({
  field,
  label,
  aria,
  align = 'left',
  className,
  sortBy,
  sortOrder,
  onSort,
}: {
  field: SortField;
  label: string;
  aria: string;
  align?: 'left' | 'right';
  className?: string;
  sortBy: SortField;
  sortOrder: 'asc' | 'desc';
  onSort: (field: SortField) => void;
}) {
  const active = sortBy === field;
  const Icon = active
    ? sortOrder === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;
  return (
    <th
      onClick={() => onSort(field)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSort(field);
        }
      }}
      role="columnheader"
      tabIndex={0}
      aria-label={`Ordenar por ${aria}`}
      aria-sort={
        active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'
      }
      className={cn(
        'group h-11 cursor-pointer select-none whitespace-nowrap px-3 align-middle text-xs font-semibold uppercase tracking-[0.04em] outline-none transition-colors focus-visible:text-foreground',
        active ? 'text-foreground' : 'text-faint hover:text-subtle',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      )}
    >
      <span
        className={cn(
          'inline-flex items-center gap-1',
          align === 'right' && 'flex-row-reverse',
        )}
      >
        {label}
        <Icon
          aria-hidden
          className={cn(
            'h-3 w-3 transition-opacity',
            active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        />
      </span>
    </th>
  );
}

function DesktopRow({
  entry,
  selected,
  busy,
  onToggle,
  onOpen,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  entry: Entry;
  selected: boolean;
  busy: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const amount = amountOf(entry);
  const split = shouldSplitTransaction(
    entry.plataforma_pago,
    entry.detalle1,
    entry.accion,
  );
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <tr
      data-state={selected ? 'selected' : undefined}
      onClick={onOpen}
      className="group cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-surface-2/60 data-[state=selected]:bg-surface-2"
    >
      <td className="w-12 pl-4 pr-0" onClick={stop}>
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={`Seleccionar fila ${entry.id}`}
          className="border-hairline-strong"
        />
      </td>
      <td className="max-w-[260px] px-3 py-2.5">
        <div className="flex items-center gap-3">
          <CategoryTile name={entry.tipo} size="sm" />
          <span className="truncate font-medium text-foreground">
            {entry.que}
          </span>
        </div>
      </td>
      <td className="whitespace-nowrap px-3 text-subtle">{entry.tipo}</td>
      <td className="whitespace-nowrap px-3">
        <span className="inline-flex items-center gap-2 text-subtle">
          <span
            aria-hidden
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              FLOW_DOT[flowOf(entry.accion)],
            )}
          />
          {entry.accion}
        </span>
      </td>
      <td className="max-w-[160px] truncate whitespace-nowrap px-3 text-subtle">
        {entry.plataforma_pago}
      </td>
      <td className="hidden whitespace-nowrap px-3 text-subtle xl:table-cell">
        {entry.quien || 'Yo'}
      </td>
      <td className="hidden max-w-[160px] truncate px-3 text-faint 2xl:table-cell">
        {entry.detalle1}
      </td>
      <td className="hidden max-w-[160px] truncate px-3 text-faint 2xl:table-cell">
        {entry.detalle2}
      </td>
      <td className="num whitespace-nowrap px-3 text-subtle">
        {shortDate(entry.fecha)}
      </td>
      <td className="whitespace-nowrap px-3 text-right">
        <RecordAmount
          accion={entry.accion}
          amount={amount}
          className="justify-end font-semibold"
        />
        {split && (
          <span
            className="num block text-[11px] text-faint"
            title="Total compartido"
          >
            {formatCurrency(amount * 2)} total
          </span>
        )}
      </td>
      <td className="pr-3" onClick={stop}>
        <div className="flex justify-end gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 group-data-[state=selected]:opacity-100">
          <RowAction
            title="Editar"
            aria-label={`Editar entrada ${entry.id}`}
            onClick={onEdit}
          >
            <Pencil />
          </RowAction>
          <RowAction
            title="Duplicar"
            aria-label={`Duplicar entrada ${entry.id}`}
            disabled={busy}
            onClick={onDuplicate}
          >
            <Copy />
          </RowAction>
          <RowAction
            title="Eliminar"
            aria-label={`Eliminar entrada ${entry.id}`}
            disabled={busy}
            onClick={onDelete}
            className="hover:text-negative"
          >
            <Trash2 />
          </RowAction>
        </div>
      </td>
    </tr>
  );
}

function RowAction({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'grid h-8 w-8 place-items-center rounded-lg text-subtle transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 [&_svg]:h-4 [&_svg]:w-4',
        className,
      )}
      {...props}
    />
  );
}

function Pagination({
  page,
  totalPages,
  totalItems,
  perPage,
  onPage,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  perPage: number;
  onPage: (page: number) => void;
}) {
  const first = (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, totalItems);
  return (
    <nav
      aria-label="Paginación"
      className="flex items-center justify-between gap-3"
    >
      <p className="num text-[13px] text-subtle">
        {totalItems > 0 ? (
          <>
            {first}–{last}{' '}
            <span className="text-faint">
              de {totalItems} · página {page} de {totalPages}
            </span>
          </>
        ) : (
          <>
            Página {page} de {totalPages}
          </>
        )}
      </p>
      <div className="flex items-center gap-1">
        <PageButton
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft />
        </PageButton>
        <PageButton
          aria-label="Página siguiente"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight />
        </PageButton>
      </div>
    </nav>
  );
}

function PageButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="grid h-11 w-11 place-items-center rounded-full bg-surface-2 text-foreground transition-colors hover:bg-surface-3 disabled:opacity-30 md:h-9 md:w-9 [&_svg]:h-4 [&_svg]:w-4"
      {...props}
    />
  );
}
