'use client';

import { AlertTriangle, Coins, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useCryptoChanged } from '@/components/crypto/crypto-form-sheet';
import { Money } from '@/components/dashboard/money';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getCryptoOverview } from '@/lib/crypto-data';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { CryptoPortfolioOverview } from '@/types/finance';

const quantityFormatter = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 8,
});

const percentFormatter = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

function formatQuantity(amount: number): string {
  return quantityFormatter.format(amount);
}

function formatSignedPL(amount: number | null): string {
  if (amount === null) return '—';
  const sign = amount > 0 ? '+' : '';
  return `${sign}${formatCurrency(amount)}`;
}

function formatPercent(value: number | null): string {
  return value === null ? '' : `${percentFormatter.format(value)} %`;
}

function plColorClass(amount: number | null): string {
  if (amount === null || amount === 0) return 'text-subtle';
  return amount > 0 ? 'text-positive' : 'text-negative';
}

/** Coin initial on a quiet tile, tinted with the investment hue. */
function CoinTile({ symbol }: { symbol: string }) {
  return (
    <span
      aria-hidden
      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-invest/15 text-[15px] font-bold tracking-[-0.02em] text-invest"
    >
      {symbol.charAt(0).toUpperCase()}
    </span>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-[168px] w-full rounded-[20px]" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-[20px]" />
        <Skeleton className="h-24 rounded-[20px]" />
      </div>
      <Skeleton className="h-48 w-full rounded-[20px]" />
    </div>
  );
}

export function CryptoOverview() {
  const [overview, setOverview] = useState<CryptoPortfolioOverview | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getCryptoOverview()
      .then((data) => {
        if (cancelled) return;
        if (data !== null) {
          setOverview(data);
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

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    const data = await getCryptoOverview();
    if (data !== null) {
      setOverview(data);
      setHasError(false);
    } else {
      setHasError(true);
    }
    setIsRefreshing(false);
  }, []);

  useCryptoChanged(
    useCallback(() => {
      void handleRefresh();
    }, [handleRefresh]),
  );

  if (isLoading) return <OverviewSkeleton />;

  if (hasError || !overview) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[20px] border border-hairline bg-surface px-6 py-10 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-surface-3 text-subtle">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <p className="text-[15px] text-subtle">
          No se pudo cargar el resumen de criptomonedas.
        </p>
        <Button variant="secondary" size="sm" onClick={handleRefresh}>
          <RefreshCw className={cn(isRefreshing && 'animate-spin')} />
          Reintentar
        </Button>
      </div>
    );
  }

  const { positions, totals, pricesUpdatedAt, missingPrices } = overview;
  const hasAnyActivity =
    positions.length > 0 ||
    totals.realizedPL !== 0 ||
    totals.totalCostBasis !== 0;

  if (!hasAnyActivity) {
    return (
      <div className="flex flex-col items-center rounded-[20px] border border-hairline bg-surface px-6 py-12 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-invest/15 text-invest">
          <Coins className="h-5 w-5" />
        </span>
        <p className="mt-4 max-w-xs text-[15px] text-subtle">
          Aún no hay transacciones de criptomonedas. Registra tu primera compra
          para ver aquí tu portafolio.
        </p>
      </div>
    );
  }

  const hasStalePrices = positions.some((position) => position.price.stale);

  return (
    <div className="space-y-6">
      <section
        aria-label="Resumen de la cartera"
        className="space-y-3 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-3 lg:space-y-0"
      >
        <div className="flex flex-col rounded-[20px] border border-hairline bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-subtle">Valor actual</p>
            <p className="text-[12px] text-faint">
              {positions.length}{' '}
              {positions.length === 1 ? 'posición' : 'posiciones'}
            </p>
          </div>
          <p className="mt-3">
            {totals.totalValue !== null ? (
              <Money
                amount={totals.totalValue}
                className="display-num text-[44px] font-semibold md:text-[56px]"
                tailClassName="text-[26px] font-medium text-faint md:text-[32px]"
              />
            ) : (
              <span className="display-num text-[44px] font-semibold text-faint">
                —
              </span>
            )}
          </p>
          <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-hairline pt-3 lg:mt-auto">
            <span className="text-[13px] text-subtle">P/L no realizado</span>
            <span
              className={cn(
                'num text-[15px] font-semibold',
                plColorClass(totals.unrealizedPL),
              )}
            >
              {formatSignedPL(totals.unrealizedPL)}
              {totals.unrealizedPLPercent !== null && (
                <span className="ml-1.5 font-medium opacity-80">
                  {formatPercent(totals.unrealizedPLPercent)}
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <div className="rounded-[20px] border border-hairline bg-surface p-4">
            <p className="text-[13px] font-medium text-subtle">
              Invertido (coste)
            </p>
            <p className="num mt-2 text-[17px] font-semibold">
              {formatCurrency(totals.totalCostBasis)}
            </p>
            <p className="text-[12px] text-faint">Posiciones abiertas</p>
          </div>
          <div className="rounded-[20px] border border-hairline bg-surface p-4">
            <p className="text-[13px] font-medium text-subtle">P/L realizado</p>
            <p
              className={cn(
                'num mt-2 text-[17px] font-semibold',
                plColorClass(totals.realizedPL),
              )}
            >
              {formatSignedPL(totals.realizedPL)}
            </p>
            <p className="text-[12px] text-faint">Ventas cerradas</p>
          </div>
        </div>
      </section>

      {(missingPrices.length > 0 || hasStalePrices) && (
        <div className="space-y-2">
          {missingPrices.length > 0 && (
            <div className="flex items-start gap-3 rounded-[16px] bg-surface-2 px-4 py-3 text-[13px] text-subtle">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
              <span>
                Sin precio en CoinGecko: {missingPrices.join(', ')}. Sus valores
                no se incluyen en los totales.
              </span>
            </div>
          )}
          {hasStalePrices && (
            <div className="rounded-[16px] bg-surface-2 px-4 py-3 text-[13px] text-subtle">
              Mostrando precios en caché; no hubo conexión con CoinGecko en esta
              actualización.
            </div>
          )}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[17px] font-semibold tracking-[-0.02em]">
            Posiciones
          </h2>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="-mr-2 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-subtle transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')}
            />
            Actualizar precios
          </button>
        </div>

        <div className="rounded-[20px] border border-hairline bg-surface px-4">
          <div
            aria-hidden
            className="hidden grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] gap-4 border-b border-hairline py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint md:grid"
          >
            <span>Activo</span>
            <span className="text-right">Precio</span>
            <span className="text-right">Coste</span>
            <span className="text-right">Valor</span>
            <span className="text-right">P/L</span>
          </div>
          <ul>
            {positions.map((position, index) => {
              const price =
                position.price.priceKnown && position.price.priceEur !== null
                  ? formatCurrency(position.price.priceEur)
                  : '—';
              const value =
                position.currentValue !== null
                  ? formatCurrency(position.currentValue)
                  : '—';
              const pl =
                position.unrealizedPL !== null
                  ? `${formatSignedPL(position.unrealizedPL)}${
                      position.unrealizedPLPercent !== null
                        ? ` · ${formatPercent(position.unrealizedPLPercent)}`
                        : ''
                    }`
                  : '—';
              return (
                <li
                  key={position.symbol}
                  className={cn(
                    'flex min-h-16 items-center gap-3 py-3 md:grid md:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] md:gap-4',
                    index > 0 && 'border-t border-hairline',
                  )}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <CoinTile symbol={position.symbol} />
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold">
                        {position.symbol}
                      </span>
                      <span className="num block truncate text-[13px] text-subtle">
                        {formatQuantity(position.amount)} {position.symbol}
                        <span className="md:hidden"> · {price}</span>
                      </span>
                    </span>
                  </span>
                  <span className="num hidden text-right text-[15px] md:block">
                    {price}
                  </span>
                  <span className="num hidden text-right text-[15px] text-subtle md:block">
                    {formatCurrency(position.costBasis)}
                  </span>
                  <span className="shrink-0 text-right md:contents">
                    <span className="num block text-[15px] font-semibold md:text-right">
                      {value}
                    </span>
                    <span
                      className={cn(
                        'num block text-[12px] font-medium md:text-right md:text-[15px]',
                        plColorClass(position.unrealizedPL),
                      )}
                    >
                      {pl}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="px-1 text-[12px] text-faint">
          Precios actualizados:{' '}
          {pricesUpdatedAt ? formatDate(pricesUpdatedAt, true) : 'desconocido'}
        </p>
      </section>
    </div>
  );
}
