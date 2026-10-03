'use client';

import { Copy, Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createElement, useState } from 'react';

import { RecordAmount } from './record-amount';
import { amountOf, longDate, timeOf } from './record-format';

import {
  CategoryTile,
  paymentIcon,
} from '@/components/quick-add/category-icon';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn, formatCurrency, shouldSplitTransaction } from '@/lib/utils';
import type { Entry } from '@/types/finance';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-t border-hairline py-3 first:border-t-0">
      <dt className="shrink-0 text-[15px] text-subtle">{label}</dt>
      <dd className="min-w-0 text-right text-[15px] font-medium [overflow-wrap:anywhere]">
        {children}
      </dd>
    </div>
  );
}

const empty = <span className="text-faint">—</span>;

/**
 * Bottom sheet with every field of one record and its actions. Delete asks
 * for confirmation inside the sheet instead of a browser dialog.
 */
export function RecordDetailSheet({
  entry,
  onOpenChange,
  onDuplicate,
  onDelete,
  busy,
}: {
  entry: Entry | null;
  onOpenChange: (open: boolean) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  busy?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  // Keep the last entry rendered while the sheet animates out.
  const [shown, setShown] = useState<Entry | null>(entry);
  if (entry && entry !== shown) {
    setShown(entry);
    setConfirming(false);
  }
  const e = entry ?? shown;
  if (!e) return null;

  const amount = amountOf(e);
  const time = timeOf(e.fecha);
  const split = shouldSplitTransaction(e.plataforma_pago, e.detalle1, e.accion);

  return (
    <Dialog
      open={entry !== null}
      onOpenChange={(open) => {
        if (!open) setConfirming(false);
        onOpenChange(open);
      }}
    >
      <DialogContent
        className="gap-0 px-4 pt-3 sm:px-6 sm:pt-6"
        onOpenAutoFocus={(ev) => {
          ev.preventDefault();
          (ev.currentTarget as HTMLElement).focus();
        }}
      >
        <div
          aria-hidden
          className="mx-auto mb-4 h-1 w-9 rounded-full bg-surface-4 sm:hidden"
        />
        <div className="flex items-center gap-3 pr-10">
          <CategoryTile name={e.tipo} size="lg" />
          <div className="min-w-0">
            <DialogTitle className="truncate text-[17px] font-semibold leading-tight tracking-[-0.02em]">
              {e.que}
            </DialogTitle>
            <DialogDescription className="mt-0.5 truncate text-[13px] text-subtle">
              {e.tipo} · {e.accion}
            </DialogDescription>
          </div>
        </div>

        <div className="pb-6 pt-7 text-center">
          <p className="display-num text-[44px] font-bold">
            <RecordAmount
              accion={e.accion}
              amount={amount}
              className="gap-2"
              iconClassName="h-7 w-7"
              tailClassName="text-[28px] tracking-[-0.03em]"
            />
          </p>
          <p className="mt-2 text-[13px] text-subtle first-letter:uppercase">
            {longDate(e.fecha)}
            {time && <span className="num"> · {time}</span>}
          </p>
        </div>

        <dl className="rounded-[20px] border border-hairline bg-surface px-4">
          <Field label="Plataforma">
            <span className="inline-flex items-center gap-2">
              {createElement(paymentIcon(e.plataforma_pago), {
                className: 'h-4 w-4 text-subtle',
                'aria-hidden': true,
              })}
              {e.plataforma_pago || empty}
            </span>
          </Field>
          <Field label="Quién">{e.quien || 'Yo'}</Field>
          <Field label="Detalle 1">{e.detalle1 ?? empty}</Field>
          <Field label="Detalle 2">{e.detalle2 ?? empty}</Field>
          {split && (
            <Field label="Total compartido">
              <span className="num">{formatCurrency(amount * 2)}</span>
            </Field>
          )}
        </dl>

        {confirming ? (
          <div
            role="alertdialog"
            aria-labelledby="confirm-delete-title"
            className="mt-4 rounded-[20px] border border-hairline bg-surface p-4"
          >
            <p
              id="confirm-delete-title"
              className="text-[15px] font-semibold tracking-[-0.01em]"
            >
              ¿Eliminar este registro?
            </p>
            <p className="mt-1 text-[13px] text-subtle">
              Se borrará de forma permanente.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={() => setConfirming(false)}
                autoFocus
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                aria-label={`Eliminar entrada ${e.id}`}
                onClick={() => onDelete(e.id)}
              >
                Eliminar
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <SheetAction
              label="Editar"
              aria-label={`Editar entrada ${e.id}`}
              onClick={() => router.push(`/edit/${e.id}`)}
            >
              <Pencil />
            </SheetAction>
            <SheetAction
              label="Duplicar"
              aria-label={`Duplicar entrada ${e.id}`}
              disabled={busy}
              onClick={() => onDuplicate(e.id)}
            >
              <Copy />
            </SheetAction>
            <SheetAction
              label="Eliminar"
              className="text-negative"
              onClick={() => setConfirming(true)}
            >
              <Trash2 />
            </SheetAction>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SheetAction({
  label,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-[68px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface-2 text-[13px] font-medium transition-[background-color,transform] duration-150 hover:bg-surface-3 active:scale-[0.97] disabled:opacity-40 [&_svg]:h-[18px] [&_svg]:w-[18px]',
        className,
      )}
      {...props}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}
