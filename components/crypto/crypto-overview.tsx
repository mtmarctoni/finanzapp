'use client';

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Coins,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getCryptoOverview } from '@/lib/crypto-data';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { CryptoPortfolioOverview } from '@/types/finance';

const quantityFormatter = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 8,
});

function formatQuantity(amount: number): string {
  return quantityFormatter.format(amount);
}

function formatSignedPL(amount: number | null): string {
  if (amount === null) return '—';
  const sign = amount > 0 ? '+' : '';
  return `${sign}${formatCurrency(amount)}`;
}

function plColorClass(amount: number | null): string {
  if (amount === null || amount === 0) return 'text-muted-foreground';
  return amount > 0 ? 'text-green-600' : 'text-red-600';
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
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

  const fetchOverview = useCallback(async () => {
    const data = await getCryptoOverview();
    if (data !== null) {
      setOverview(data);
      setHasError(false);
    } else {
      setHasError(true);
    }
  }, []);

  useEffect(() => {
    void fetchOverview().finally(() => setIsLoading(false));
  }, [fetchOverview]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchOverview();
    setIsRefreshing(false);
  };

  if (isLoading) return <OverviewSkeleton />;

  if (hasError || !overview) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-muted-foreground">
            No se pudo cargar el resumen de criptomonedas.
          </p>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { positions, totals, pricesUpdatedAt, missingPrices } = overview;
  const hasAnyActivity =
    positions.length > 0 ||
    totals.realizedPL !== 0 ||
    totals.totalCostBasis !== 0;

  if (!hasAnyActivity) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">
            Aún no hay transacciones de criptomonedas. Registra tu primera
            compra para ver aquí tu portafolio.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasStalePrices = positions.some((position) => position.price.stale);
  const unrealizedPositive = (totals.unrealizedPL ?? 0) >= 0;
  const realizedPositive = totals.realizedPL >= 0;

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor actual</CardTitle>
            <Wallet className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totals.totalValue !== null
                ? formatCurrency(totals.totalValue)
                : '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              {positions.length}{' '}
              {positions.length === 1 ? 'posición' : 'posiciones'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Invertido (coste)
            </CardTitle>
            <Coins className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totals.totalCostBasis)}
            </div>
            <p className="text-xs text-muted-foreground">
              Coste de las posiciones actuales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              P/L no realizado
            </CardTitle>
            {unrealizedPositive ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'text-2xl font-bold',
                plColorClass(totals.unrealizedPL),
              )}
            >
              {formatSignedPL(totals.unrealizedPL)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totals.unrealizedPLPercent !== null
                ? `${totals.unrealizedPLPercent.toFixed(1)}% sobre el coste`
                : 'Faltan precios por calcular'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">P/L realizado</CardTitle>
            {realizedPositive ? (
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'text-2xl font-bold',
                plColorClass(totals.realizedPL),
              )}
            >
              {formatSignedPL(totals.realizedPL)}
            </div>
            <p className="text-xs text-muted-foreground">
              Beneficio de ventas cerradas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Warnings */}
      {missingPrices.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Sin precio en CoinGecko: {missingPrices.join(', ')}. Sus valores no
            se incluyen en los totales.
          </span>
        </div>
      )}
      {hasStalePrices && (
        <div className="rounded-md border border-muted bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Mostrando precios en caché; no hubo conexión con CoinGecko en esta
          actualización.
        </div>
      )}

      {/* Holdings table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Posiciones</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={cn('mr-2 h-4 w-4', isRefreshing && 'animate-spin')}
            />
            Actualizar precios
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Símbolo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Precio actual</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Coste</TableHead>
                <TableHead className="text-right">P/L ± %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((position) => (
                <TableRow key={position.symbol}>
                  <TableCell className="font-medium">
                    {position.symbol}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatQuantity(position.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {position.price.priceKnown &&
                    position.price.priceEur !== null
                      ? formatCurrency(position.price.priceEur)
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {position.currentValue !== null
                      ? formatCurrency(position.currentValue)
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(position.costBasis)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right',
                      plColorClass(position.unrealizedPL),
                    )}
                  >
                    {position.unrealizedPL !== null
                      ? `${formatSignedPL(position.unrealizedPL)}${
                          position.unrealizedPLPercent !== null
                            ? ` (${position.unrealizedPLPercent.toFixed(1)}%)`
                            : ''
                        }`
                      : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Precios actualizados:{' '}
            {pricesUpdatedAt
              ? formatDate(pricesUpdatedAt, true)
              : 'desconocido'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default CryptoOverview;
