'use client';

import { CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Money } from '@/components/dashboard/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  SafeboxRequestError,
  createSafeboxMovement,
  getSafeboxSummary,
} from '@/lib/safebox-data';
import { cn, formatCurrency } from '@/lib/utils';

/**
 * Physical-count check: the user counts the cash in the safe and types the
 * real amount. A difference never rewrites the ledger silently — it shows
 * the variance and, only on confirmation, appends a signed adjustment with
 * a note so the history keeps explaining the expected balance.
 */

/** "12,5" -> "12.5", one decimal separator, at most 2 decimals. */
function sanitizeAmount(raw: string) {
  const cleaned = raw.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const [int = '', ...rest] = cleaned.split('.');
  if (rest.length === 0) return int.slice(0, 9);
  return `${int.slice(0, 9)}.${rest.join('').slice(0, 2)}`;
}

function parseCounted(raw: string): number | null {
  if (raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function SafeboxCountForm({
  onDone,
}: {
  onDone: (saved: boolean) => void;
}) {
  const [expected, setExpected] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [countedRaw, setCountedRaw] = useState('');
  const [compared, setCompared] = useState(false);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getSafeboxSummary()
      .then((summary) => {
        if (cancelled) return;
        if (summary) setExpected(summary.balance);
        else setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const counted = parseCounted(countedRaw);
  const varianceCents =
    expected !== null && counted !== null
      ? Math.round(counted * 100) - Math.round(expected * 100)
      : null;
  const variance = varianceCents !== null ? varianceCents / 100 : null;

  const handleCountedChange = (raw: string) => {
    setCountedRaw(sanitizeAmount(raw));
    setCompared(false);
    setServerError(null);
  };

  const handleCompare = () => {
    if (counted === null || expected === null) return;
    setNote(
      `Recuento físico: esperados ${formatCurrency(expected)}, contados ${formatCurrency(counted)}.`,
    );
    setCompared(true);
  };

  const handleAdjust = async () => {
    if (variance === null || variance === 0 || !note.trim()) return;
    setIsSubmitting(true);
    setServerError(null);
    try {
      await createSafeboxMovement({
        movementType: 'adjustment',
        amount: variance,
        note: note.trim(),
        movementDate: new Date().toISOString(),
      });
      onDone(true);
    } catch (error) {
      setServerError(
        error instanceof SafeboxRequestError
          ? error.message
          : 'No se pudo registrar el ajuste.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <p className="py-6 text-[14px] text-subtle">Cargando…</p>;
  }

  if (loadError || expected === null) {
    return (
      <div>
        <h2 className="text-[20px] font-bold tracking-[-0.02em]">
          Contar efectivo
        </h2>
        <p role="alert" className="mt-3 text-[13px] text-negative">
          No se pudo cargar el saldo esperado. Inténtalo de nuevo.
        </p>
        <div className="mt-5 flex justify-end">
          <Button variant="secondary" onClick={() => onDone(false)}>
            Cerrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-[20px] font-bold tracking-[-0.02em]">
        Contar efectivo
      </h2>
      <p className="mt-1 text-[13px] leading-snug text-subtle">
        Cuenta el efectivo real de la caja fuerte y comparalo con lo que debería
        haber según los movimientos registrados.
      </p>

      <div className="mt-5 space-y-4">
        <div className="rounded-[16px] border border-hairline bg-surface-2 px-4 py-3">
          <p className="text-[13px] font-medium text-subtle">
            Efectivo esperado
          </p>
          <p className="num mt-1 text-[24px] font-semibold">
            <Money amount={expected} tailClassName="text-[0.7em]" />
          </p>
        </div>

        <div>
          <label
            htmlFor="safebox-counted"
            className="text-[13px] font-medium text-subtle"
          >
            Efectivo contado
          </label>
          <Input
            id="safebox-counted"
            value={countedRaw.replace('.', ',')}
            onChange={(event) => handleCountedChange(event.target.value)}
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            autoComplete="off"
            className="num mt-1.5"
          />
        </div>

        {!compared && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCompare}
              disabled={counted === null}
            >
              Comparar
            </Button>
          </div>
        )}

        {compared && variance === 0 && (
          <div className="flex items-center gap-3 rounded-[16px] bg-positive/10 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-positive" />
            <p className="text-[14px] font-medium">
              Cuadra perfectamente: no hace falta ningún ajuste.
            </p>
          </div>
        )}

        {compared && variance !== null && variance !== 0 && (
          <div className="space-y-4">
            <div className="rounded-[16px] border border-hairline bg-surface-2 px-4 py-3">
              <p className="text-[13px] font-medium text-subtle">Diferencia</p>
              <p
                className={cn(
                  'num mt-1 text-[24px] font-semibold',
                  variance > 0 && 'text-positive',
                )}
              >
                <Money amount={variance} signed tailClassName="text-[0.7em]" />
              </p>
              <p className="mt-1 text-[12px] leading-snug text-faint">
                Revisa primero si falta algún movimiento por registrar. Si la
                diferencia es real, guárdala como ajuste para que el saldo
                esperado vuelva a cuadrar.
              </p>
            </div>

            <div>
              <label
                htmlFor="safebox-count-note"
                className="text-[13px] font-medium text-subtle"
              >
                Motivo del ajuste
              </label>
              <Input
                id="safebox-count-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                type="text"
                maxLength={255}
                className="mt-1.5"
              />
            </div>

            {serverError && (
              <p role="alert" className="text-[13px] text-negative">
                {serverError}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="secondary"
            onClick={() => onDone(false)}
            disabled={isSubmitting}
          >
            {compared && variance === 0 ? 'Cerrar' : 'Cancelar'}
          </Button>
          {compared && variance !== null && variance !== 0 && (
            <Button
              onClick={handleAdjust}
              disabled={isSubmitting || !note.trim()}
            >
              {isSubmitting
                ? 'Guardando…'
                : `Guardar ajuste de ${formatCurrency(variance)}`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
