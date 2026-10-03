'use client';

import {
  ArrowDown,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Copy,
  Flag,
  Gift,
  type LucideIcon,
  Pencil,
  Percent,
  Receipt,
  Repeat2,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState, useTransition } from 'react';

import {
  openCryptoForm,
  useCryptoChanged,
} from '@/components/crypto/crypto-form-sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ITEMS_PER_PAGE } from '@/config';
import {
  getCryptoTransactions,
  deleteCryptoTransaction,
  duplicateCryptoTransaction,
} from '@/lib/crypto-data';
import { cn, formatCurrency } from '@/lib/utils';
import type { CryptoTransaction } from '@/types/finance';

interface CryptoTransactionsResponse {
  data: CryptoTransaction[];
  total: number;
  totalPages: number;
  currentPage: number;
}

/**
 * Direction drives the amount's sign: what enters the portfolio is +, what
 * leaves it is -, and moves between your own wallets carry no sign.
 */
const TRANSACTION_TYPES: Record<
  string,
  { label: string; icon: LucideIcon; direction: 'in' | 'out' | 'move' }
> = {
  deposit: { label: 'Depósito', icon: ArrowDownLeft, direction: 'in' },
  withdrawal: { label: 'Retiro', icon: ArrowUpRight, direction: 'out' },
  wallet_transfer: {
    label: 'Transferencia',
    icon: ArrowLeftRight,
    direction: 'move',
  },
  exchange: { label: 'Intercambio', icon: Repeat2, direction: 'move' },
  staking: { label: 'Staking', icon: Percent, direction: 'in' },
  airdrop: { label: 'Airdrop', icon: Gift, direction: 'in' },
  fee: { label: 'Comisión', icon: Receipt, direction: 'out' },
  genesis: { label: 'Génesis', icon: Flag, direction: 'in' },
};

function typeInfo(type: string) {
  return (
    TRANSACTION_TYPES[type] ?? {
      label: type,
      icon: ArrowLeftRight,
      direction: 'move' as const,
    }
  );
}

const shortDate = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: '2-digit',
});

function formatShortDate(value: string) {
  return shortDate.format(new Date(value)).replace('.', '');
}

function formatCryptoAmount(amount: number, symbol: string) {
  return `${Number(amount).toLocaleString('es-ES', { maximumFractionDigits: 8 })} ${symbol}`;
}

const CHECKBOX =
  'h-[18px] w-[18px] rounded-[5px] border-hairline-strong data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background';

function TypeTile({ type }: { type: string }) {
  const { icon: Icon, direction } = typeInfo(type);
  return (
    <span
      aria-hidden
      className={cn(
        'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
        direction === 'in'
          ? 'bg-invest/15 text-invest'
          : 'bg-surface-3 text-subtle',
      )}
    >
      <Icon className="h-[18px] w-[18px]" />
    </span>
  );
}

function signedAmount(transaction: CryptoTransaction) {
  const { direction } = typeInfo(transaction.transactionType);
  const sign = direction === 'in' ? '+' : direction === 'out' ? '-' : '';
  return `${sign}${formatCryptoAmount(transaction.amount, transaction.cryptoSymbol)}`;
}

function walletRoute(transaction: CryptoTransaction) {
  const { fromWallet, toWallet } = transaction;
  if (fromWallet && toWallet) return `${fromWallet} → ${toWallet}`;
  return fromWallet ?? toWallet ?? null;
}

export default function CryptoTransactionTable({
  searchParams,
}: {
  searchParams?: {
    search?: string;
    transactionType?: string;
    cryptoSymbol?: string;
    from?: string;
    to?: string;
    page?: string;
    itemsPerPage?: string;
    sortBy?: string;
    sortOrder?: string;
  };
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [transactions, setTransactions] = useState<CryptoTransactionsResponse>({
    data: [],
    total: 0,
    totalPages: 0,
    currentPage: 1,
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const search = searchParams?.search ?? '';
  const transactionType =
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty URL param must fall back to 'all'
    searchParams?.transactionType || 'all';
  const cryptoSymbol = searchParams?.cryptoSymbol ?? '';
  const from = searchParams?.from ?? '';
  const to = searchParams?.to ?? '';
  const { data: session } = useSession();
  const currentPage = Number(searchParams?.page) || 1;
  const itemsPerPage = Number(searchParams?.itemsPerPage) || ITEMS_PER_PAGE;
  const rawSortBy = searchParams?.sortBy;
  const [sortBy, setSortBy] = useState<
    'transaction_date' | 'crypto_symbol' | 'amount' | 'transaction_type'
  >(
    rawSortBy === 'transaction_date' ||
      rawSortBy === 'crypto_symbol' ||
      rawSortBy === 'amount' ||
      rawSortBy === 'transaction_type'
      ? rawSortBy
      : 'transaction_date',
  );
  const rawSortOrder = searchParams?.sortOrder;
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    rawSortOrder === 'asc' || rawSortOrder === 'desc' ? rawSortOrder : 'desc',
  );

  const [activeTransaction, setActiveTransaction] =
    useState<CryptoTransaction | null>(null);

  const fetchTransactions = useCallback(async () => {
    const result = await getCryptoTransactions({
      search,
      transactionType,
      cryptoSymbol,
      from,
      to,
      page: currentPage,
      itemsPerPage,
      sortBy,
      sortOrder,
    });
    setTransactions({
      data: result.data ?? [],
      total: result.total ?? 0,
      totalPages: result.totalPages ?? 0,
      currentPage: result.currentPage ?? currentPage,
    });
  }, [
    search,
    transactionType,
    cryptoSymbol,
    from,
    to,
    currentPage,
    itemsPerPage,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-change of the URL filters
    void fetchTransactions();
  }, [fetchTransactions]);

  useCryptoChanged(
    useCallback(() => {
      void fetchTransactions();
    }, [fetchTransactions]),
  );

  const allSelected =
    transactions.data.length > 0 &&
    selectedIds.length === transactions.data.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(transactions.data.map((t) => t.id));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleSort = (
    field: 'transaction_date' | 'crypto_symbol' | 'amount' | 'transaction_type',
  ) => {
    const nextOrder = sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortBy(field);
    setSortOrder(nextOrder);
    const params = new URLSearchParams(searchParams as Record<string, string>);
    params.set('sortBy', field);
    params.set('sortOrder', nextOrder);
    router.push(`/investment/crypto?${params.toString()}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta transacción?')) return;
    setActiveTransaction(null);

    startTransition(async () => {
      const success = await deleteCryptoTransaction(id);
      if (success) {
        setTransactions((prev) => ({
          ...prev,
          data: prev.data.filter((t) => t.id !== id),
          total: Math.max(0, prev.total - 1),
        }));
      }
    });
  };

  const handleDeleteMany = async () => {
    if (
      !confirm(`¿Estás seguro de eliminar ${selectedIds.length} transacciones?`)
    )
      return;

    startTransition(async () => {
      let deletedCount = 0;
      for (const id of selectedIds) {
        const success = await deleteCryptoTransaction(id);
        if (success) deletedCount++;
      }

      setTransactions((prev) => ({
        ...prev,
        data: prev.data.filter((t) => !selectedIds.includes(t.id)),
        total: Math.max(0, prev.total - deletedCount),
      }));
      setSelectedIds([]);
    });
  };

  const handleDuplicate = async (id: string) => {
    if (!session?.user.id) {
      alert('Debes iniciar sesión para duplicar transacciones');
      return;
    }

    try {
      await duplicateCryptoTransaction(id, {
        user: { id: session.user.id },
      });
      setActiveTransaction(null);
      await fetchTransactions();
    } catch (error) {
      console.error('Error duplicating transaction:', error);
      alert('Error al duplicar la transacción');
    }
  };

  const handleEdit = (transaction: CryptoTransaction) => {
    setActiveTransaction(null);
    openCryptoForm(transaction);
  };

  const totalPages = transactions.totalPages;

  const createPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams as Record<string, string>);
    params.set('page', page.toString());
    return `/investment/crypto?${params.toString()}`;
  };

  const sortHeader = (
    field: 'transaction_date' | 'crypto_symbol' | 'amount' | 'transaction_type',
    label: string,
    align: 'left' | 'right' = 'left',
  ) => {
    const active = sortBy === field;
    const Icon = !active
      ? ArrowUpDown
      : sortOrder === 'asc'
        ? ArrowUp
        : ArrowDown;
    return (
      <th
        key={field}
        scope="col"
        aria-sort={
          active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'
        }
        className={cn(
          'px-3 py-3 font-semibold',
          align === 'right' && 'text-right',
        )}
      >
        <button
          type="button"
          onClick={() => handleSort(field)}
          className={cn(
            'inline-flex items-center gap-1 uppercase tracking-[0.06em] transition-colors hover:text-foreground',
            active && 'text-subtle',
          )}
        >
          {label}
          <Icon className={cn('h-3 w-3', !active && 'opacity-50')} />
        </button>
      </th>
    );
  };

  const empty = transactions.data.length === 0;

  return (
    <section className="space-y-3">
      <div className="flex min-h-9 items-center justify-between px-1">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em]">
          Movimientos
        </h2>
        {selectedIds.length > 0 ? (
          <button
            type="button"
            onClick={handleDeleteMany}
            disabled={isPending}
            aria-label="Eliminar transacciones seleccionadas"
            className="hidden h-9 items-center gap-1.5 rounded-full bg-negative/10 px-3 text-[13px] font-semibold text-negative md:inline-flex"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar {selectedIds.length}
          </button>
        ) : (
          <span className="text-[13px] text-faint">
            {transactions.total}{' '}
            {transactions.total === 1 ? 'movimiento' : 'movimientos'}
          </span>
        )}
      </div>

      {empty ? (
        <div className="rounded-[20px] border border-hairline bg-surface px-6 py-12 text-center text-[15px] text-subtle">
          No hay transacciones
        </div>
      ) : (
        <>
          {/* Mobile: rows */}
          <ul className="rounded-[20px] border border-hairline bg-surface px-4 md:hidden">
            {transactions.data.map((transaction, index) => {
              const info = typeInfo(transaction.transactionType);
              const route = walletRoute(transaction);
              return (
                <li
                  key={transaction.id}
                  className={cn(index > 0 && 'border-t border-hairline')}
                >
                  <button
                    type="button"
                    onClick={() => setActiveTransaction(transaction)}
                    className="flex min-h-16 w-full items-center gap-3 py-3 text-left"
                  >
                    <TypeTile type={transaction.transactionType} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">
                        {info.label} · {transaction.cryptoSymbol}
                        {transaction.transactionType === 'exchange' &&
                          transaction.toCryptoSymbol && (
                            <span className="text-subtle">
                              {' '}
                              → {transaction.toCryptoSymbol}
                            </span>
                          )}
                      </span>
                      <span className="block truncate text-[13px] text-subtle">
                        {route ?? transaction.notes ?? 'Sin wallet'}
                      </span>
                    </span>
                    <span className="max-w-[45%] shrink-0 text-right">
                      <span
                        className={cn(
                          'num block truncate text-[15px] font-semibold',
                          info.direction === 'in' && 'text-invest',
                        )}
                      >
                        {signedAmount(transaction)}
                      </span>
                      <span className="block text-[12px] text-faint">
                        {formatShortDate(transaction.transactionDate)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-[20px] border border-hairline bg-surface md:block">
            <table className="w-full text-[14px]">
              <thead className="border-b border-hairline text-left text-[11px] text-faint">
                <tr>
                  <th scope="col" className="w-10 py-3 pl-4">
                    <Checkbox
                      className={CHECKBOX}
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Seleccionar todas las filas"
                    />
                  </th>
                  {sortHeader('transaction_date', 'Fecha')}
                  {sortHeader('transaction_type', 'Tipo')}
                  {sortHeader('crypto_symbol', 'Cripto')}
                  {sortHeader('amount', 'Cantidad', 'right')}
                  <th
                    scope="col"
                    className="px-3 py-3 font-semibold uppercase tracking-[0.06em]"
                  >
                    Wallets
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-right font-semibold uppercase tracking-[0.06em]"
                  >
                    Precio
                  </th>
                  <th scope="col" className="w-[132px] py-3 pr-4">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.data.map((transaction) => {
                  const info = typeInfo(transaction.transactionType);
                  const selected = selectedIds.includes(transaction.id);
                  return (
                    <tr
                      key={transaction.id}
                      data-state={selected ? 'selected' : undefined}
                      className="group border-t border-hairline first:border-t-0 transition-colors hover:bg-surface-2/50 data-[state=selected]:bg-surface-2"
                    >
                      <td className="py-2.5 pl-4">
                        <Checkbox
                          className={CHECKBOX}
                          checked={selected}
                          onCheckedChange={() => toggleOne(transaction.id)}
                          aria-label={`Seleccionar transacción ${transaction.id}`}
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-subtle">
                        {formatShortDate(transaction.transactionDate)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-2.5">
                          <TypeTile type={transaction.transactionType} />
                          <span className="font-medium">{info.label}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-semibold">
                        {transaction.cryptoSymbol}
                        {transaction.transactionType === 'exchange' &&
                          transaction.toCryptoSymbol && (
                            <span className="font-normal text-subtle">
                              {' '}
                              → {transaction.toCryptoSymbol}
                            </span>
                          )}
                      </td>
                      <td className="num px-3 py-2.5 text-right">
                        <span
                          className={cn(
                            'font-semibold',
                            info.direction === 'in' && 'text-invest',
                          )}
                        >
                          {signedAmount(transaction)}
                        </span>
                        {transaction.transactionType === 'exchange' &&
                          transaction.toAmount && (
                            <span className="block text-[12px] text-subtle">
                              →{' '}
                              {formatCryptoAmount(
                                transaction.toAmount,
                                transaction.toCryptoSymbol ?? '',
                              )}
                            </span>
                          )}
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-2.5 text-subtle">
                        {walletRoute(transaction) ?? '—'}
                      </td>
                      <td className="num px-3 py-2.5 text-right text-subtle">
                        {transaction.priceAtTransaction
                          ? formatCurrency(
                              Number(transaction.priceAtTransaction),
                            )
                          : '—'}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="flex justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => handleEdit(transaction)}
                            aria-label="Editar"
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={async () =>
                              handleDuplicate(transaction.id)
                            }
                            aria-label="Duplicar"
                            title="Duplicar"
                          >
                            <Copy />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 hover:text-negative"
                            onClick={async () => handleDelete(transaction.id)}
                            disabled={isPending}
                            aria-label="Eliminar"
                          >
                            <Trash2 />
                          </Button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Paginación"
          className="flex items-center justify-between px-1"
        >
          <span className="text-[13px] text-faint">
            {(currentPage - 1) * itemsPerPage + 1}–
            {Math.min(currentPage * itemsPerPage, transactions.total)} de{' '}
            {transactions.total}
          </span>
          <span className="flex items-center gap-1">
            <PageLink
              href={createPageUrl(currentPage - 1)}
              disabled={currentPage <= 1}
              label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </PageLink>
            <span className="num px-2 text-[13px] text-subtle">
              {currentPage} / {totalPages}
            </span>
            <PageLink
              href={createPageUrl(currentPage + 1)}
              disabled={currentPage >= totalPages}
              label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </PageLink>
          </span>
        </nav>
      )}

      <Dialog
        open={activeTransaction !== null}
        onOpenChange={(open) => !open && setActiveTransaction(null)}
      >
        <DialogContent aria-describedby={undefined}>
          {activeTransaction && (
            <TransactionSheet
              transaction={activeTransaction}
              pending={isPending}
              onEdit={() => handleEdit(activeTransaction)}
              onDuplicate={async () => handleDuplicate(activeTransaction.id)}
              onDelete={async () => handleDelete(activeTransaction.id)}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className =
    'grid h-11 w-11 place-items-center rounded-full bg-surface-2 text-subtle transition-colors hover:text-foreground';
  if (disabled) {
    return (
      <span aria-disabled className={cn(className, 'opacity-40')}>
        {children}
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <Link href={href} className={className} aria-label={label}>
      {children}
    </Link>
  );
}

function SheetRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-t border-hairline py-2 first:border-t-0">
      <span className="text-[15px] text-subtle">{label}</span>
      <span className="num min-w-0 truncate text-right text-[15px] font-medium">
        {value}
      </span>
    </div>
  );
}

/** Mobile detail for one movement, with its three actions. */
function TransactionSheet({
  transaction,
  pending,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  transaction: CryptoTransaction;
  pending: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const info = typeInfo(transaction.transactionType);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 pr-10">
        <TypeTile type={transaction.transactionType} />
        <div className="min-w-0">
          <DialogTitle className="truncate text-[22px] font-semibold tracking-[-0.03em]">
            {info.label} · {transaction.cryptoSymbol}
          </DialogTitle>
          <p className="text-[13px] text-subtle">
            {formatShortDate(transaction.transactionDate)}
          </p>
        </div>
      </div>

      <p
        className={cn(
          'display-num text-[36px] font-semibold',
          info.direction === 'in' && 'text-invest',
        )}
      >
        {signedAmount(transaction)}
      </p>

      <div className="rounded-[16px] bg-surface-2 px-4">
        {transaction.transactionType === 'exchange' && transaction.toAmount && (
          <SheetRow
            label="Recibido"
            value={formatCryptoAmount(
              transaction.toAmount,
              transaction.toCryptoSymbol ?? '',
            )}
          />
        )}
        <SheetRow label="Desde" value={transaction.fromWallet ?? '—'} />
        <SheetRow label="Hacia" value={transaction.toWallet ?? '—'} />
        <SheetRow
          label="Precio"
          value={
            transaction.priceAtTransaction
              ? formatCurrency(Number(transaction.priceAtTransaction))
              : '—'
          }
        />
        {Number(transaction.fee) > 0 && (
          <SheetRow
            label="Comisión"
            value={formatCryptoAmount(
              transaction.fee,
              transaction.feeCrypto ?? transaction.cryptoSymbol,
            )}
          />
        )}
        {transaction.notes && (
          <SheetRow label="Notas" value={transaction.notes} />
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" onClick={onEdit}>
          <Pencil />
          Editar
        </Button>
        <Button variant="secondary" onClick={onDuplicate}>
          <Copy />
          Duplicar
        </Button>
        <Button
          variant="secondary"
          className="text-negative hover:text-negative"
          onClick={onDelete}
          disabled={pending}
        >
          <Trash2 />
          Eliminar
        </Button>
      </div>
    </div>
  );
}
