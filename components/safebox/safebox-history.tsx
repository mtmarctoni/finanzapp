'use client';

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  Scale,
  Trash2,
  Vault,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Money } from '@/components/dashboard/money';
import { useSafeboxChanged } from '@/components/safebox/safebox-form-sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  SafeboxRequestError,
  deleteSafeboxMovement,
  getSafeboxMovements,
} from '@/lib/safebox-data';
import { cn, formatDate } from '@/lib/utils';
import type {
  SafeboxMovementType,
  SafeboxMovementWithBalance,
} from '@/types/finance';

const TYPE_META: Record<
  SafeboxMovementType,
  { label: string; icon: typeof Vault; tileClass: string }
> = {
  opening: {
    label: 'Saldo inicial',
    icon: Vault,
    tileClass: 'bg-surface-3 text-subtle',
  },
  deposit: {
    label: 'Ingreso',
    icon: ArrowDownToLine,
    tileClass: 'bg-positive/15 text-positive',
  },
  withdrawal: {
    label: 'Retirada',
    icon: ArrowUpFromLine,
    tileClass: 'bg-surface-3 text-subtle',
  },
  adjustment: {
    label: 'Ajuste de recuento',
    icon: Scale,
    tileClass: 'bg-invest/15 text-invest',
  },
};

/** Signed contribution: withdrawals subtract, adjustments carry their sign. */
function signedAmount(movement: SafeboxMovementWithBalance): number {
  return movement.movementType === 'withdrawal'
    ? -movement.amount
    : movement.amount;
}

function HistorySkeleton() {
  return <Skeleton className="h-72 w-full rounded-[20px]" />;
}

function MovementRow({
  movement,
  isFirst,
  onDeleted,
}: {
  movement: SafeboxMovementWithBalance;
  isFirst: boolean;
  onDeleted: () => void;
}) {
  const meta = TYPE_META[movement.movementType];
  const amount = signedAmount(movement);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (isDeleting) return;
    if (!confirm('¿Eliminar este movimiento de la caja fuerte?')) return;
    setIsDeleting(true);
    try {
      await deleteSafeboxMovement(movement.id);
      onDeleted();
    } catch (error) {
      alert(
        error instanceof SafeboxRequestError
          ? error.message
          : 'No se pudo eliminar el movimiento.',
      );
      setIsDeleting(false);
    }
  };

  return (
    <li
      className={cn(
        'flex min-h-16 items-center gap-3 py-3',
        !isFirst && 'border-t border-hairline',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
          meta.tileClass,
        )}
      >
        <meta.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">
          {meta.label}
        </span>
        <span className="block truncate text-[13px] text-subtle">
          {movement.note ?? formatDate(movement.movementDate)}
          {movement.note && ` · ${formatDate(movement.movementDate)}`}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span
          className={cn(
            'num block text-[15px] font-semibold',
            amount > 0 && 'text-positive',
          )}
        >
          {amount > 0 ? '+' : ''}
          <Money amount={amount} />
        </span>
        <span className="num block text-[12px] text-faint">
          Quedan <Money amount={movement.balanceAfter} />
        </span>
      </span>

      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        aria-label={`Eliminar ${meta.label.toLowerCase()} del ${formatDate(movement.movementDate)}`}
        className="-mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-negative disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

export function SafeboxHistory() {
  const [movements, setMovements] = useState<
    SafeboxMovementWithBalance[] | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const load = useCallback(async () => {
    const data = await getSafeboxMovements();
    if (data !== null) {
      setMovements(data);
      setHasError(false);
    } else {
      setHasError(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getSafeboxMovements()
      .then((data) => {
        if (cancelled) return;
        if (data !== null) {
          setMovements(data);
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

  if (isLoading) return <HistorySkeleton />;

  if (hasError || !movements) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[20px] border border-hairline bg-surface px-6 py-10 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-surface-3 text-subtle">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <p className="text-[15px] text-subtle">
          No se pudo cargar el historial de la caja fuerte.
        </p>
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          <RefreshCw />
          Reintentar
        </Button>
      </div>
    );
  }

  // The overview's empty state covers the no-movements case.
  if (movements.length === 0) return null;

  return (
    <section aria-label="Historial de movimientos" className="space-y-3">
      <h2 className="px-1 text-[17px] font-semibold tracking-[-0.02em]">
        Historial
      </h2>
      <ul className="rounded-[20px] border border-hairline bg-surface px-4">
        {movements.map((movement, index) => (
          <MovementRow
            key={movement.id}
            movement={movement}
            isFirst={index === 0}
            onDeleted={() => void load()}
          />
        ))}
      </ul>
    </section>
  );
}
