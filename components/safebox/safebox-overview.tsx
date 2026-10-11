'use client';

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  Scale,
  Vault,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Money } from '@/components/dashboard/money';
import {
  openSafeboxForm,
  useSafeboxChanged,
} from '@/components/safebox/safebox-form-sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getSafeboxSummary } from '@/lib/safebox-data';
import { cn, formatCurrency } from '@/lib/utils';
import type { SafeboxSummary } from '@/types/finance';

function OverviewSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-[188px] w-full rounded-[20px]" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-24 rounded-[20px]" />
        <Skeleton className="h-24 rounded-[20px]" />
        <Skeleton className="h-24 rounded-[20px]" />
      </div>
    </div>
  );
}

/** Empty state: the ledger starts with the physical opening count. */
function EmptySafebox() {
  return (
    <div className="flex flex-col items-center rounded-[20px] border border-hairline bg-surface px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-surface-3 text-subtle">
        <Vault className="h-5 w-5" />
      </span>
      <p className="mt-4 max-w-xs text-[15px] text-subtle">
        Cuenta el efectivo que guardas en la caja fuerte y regístralo como saldo
        inicial. A partir de ahí, cada ingreso y retirada quedará anotado.
      </p>
      <Button className="mt-5" onClick={() => openSafeboxForm('opening')}>
        <Vault />
        Anotar saldo inicial
      </Button>
    </div>
  );
}

export function SafeboxOverview() {
  const [summary, setSummary] = useState<SafeboxSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await getSafeboxSummary();
    if (data !== null) {
      setSummary(data);
      setHasError(false);
    } else {
      setHasError(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getSafeboxSummary()
      .then((data) => {
        if (cancelled) return;
        if (data !== null) {
          setSummary(data);
          setHasError(false);
        } else {
          setHasError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useSafeboxChanged(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  if (isLoading) return <OverviewSkeleton />;

  if (hasError || !summary) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[20px] border border-hairline bg-surface px-6 py-10 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-surface-3 text-subtle">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <p className="text-[15px] text-subtle">
          No se pudo cargar el saldo de la caja fuerte.
        </p>
        <Button variant="secondary" size="sm" onClick={handleRefresh}>
          <RefreshCw className={cn(isRefreshing && 'animate-spin')} />
          Reintentar
        </Button>
      </div>
    );
  }

  if (summary.movementCount === 0) return <EmptySafebox />;

  // "Entradas" folds the opening count with deposits; neither is income.
  const tiles = [
    { label: 'Entradas', amount: summary.totalIn, signed: false },
    { label: 'Salidas', amount: summary.totalOut, signed: false },
    { label: 'Ajustes', amount: summary.totalAdjustments, signed: true },
  ];

  return (
    <div className="space-y-3">
      <section
        aria-label="Efectivo esperado en la caja fuerte"
        className="rounded-[20px] border border-hairline bg-surface p-5"
      >
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-subtle">
            Efectivo esperado
          </p>
          <p className="text-[12px] text-faint">
            {summary.movementCount}{' '}
            {summary.movementCount === 1 ? 'movimiento' : 'movimientos'}
          </p>
        </div>
        <p className="mt-3">
          <Money
            amount={summary.balance}
            className="display-num text-[44px] font-semibold md:text-[56px]"
            tailClassName="text-[26px] font-medium text-faint md:text-[32px]"
          />
        </p>
        <p className="mt-1 text-[12px] leading-snug text-faint">
          Lo que debería haber en la caja según los movimientos registrados.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Button
            className="h-16 flex-col gap-1 px-2 text-[13px]"
            onClick={() => openSafeboxForm('deposit')}
          >
            <ArrowDownToLine />
            Ingresar
          </Button>
          <Button
            variant="secondary"
            className="h-16 flex-col gap-1 px-2 text-[13px]"
            onClick={() => openSafeboxForm('withdrawal')}
          >
            <ArrowUpFromLine />
            Retirar
          </Button>
          <Button
            variant="secondary"
            className="h-16 flex-col gap-1 px-2 text-[13px]"
            onClick={() => openSafeboxForm('count')}
          >
            <Scale />
            Contar
          </Button>
        </div>
      </section>

      <section
        aria-label="Totales acumulados"
        className="grid grid-cols-3 gap-3"
      >
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-[20px] border border-hairline bg-surface p-4"
          >
            <p className="truncate text-[13px] font-medium text-subtle">
              {tile.label}
            </p>
            <p
              className={cn(
                'num mt-2 truncate text-[15px] font-semibold md:text-[17px]',
                tile.signed && tile.amount > 0 && 'text-positive',
              )}
            >
              {tile.signed && tile.amount > 0 ? '+' : ''}
              {formatCurrency(tile.amount)}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
