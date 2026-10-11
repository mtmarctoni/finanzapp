'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { type Resolver, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { SafeboxRequestError, createSafeboxMovement } from '@/lib/safebox-data';
import type { SafeboxMovementType } from '@/types/finance';

export type SafeboxMovementFormMode = Exclude<
  SafeboxMovementType,
  'adjustment'
>;

const MODE_COPY: Record<
  SafeboxMovementFormMode,
  { title: string; description: string; submit: string }
> = {
  opening: {
    title: 'Saldo inicial',
    description:
      'Cuenta el efectivo que hay ahora mismo en la caja fuerte. A partir de aquí, cada entrada y salida quedará registrada.',
    submit: 'Guardar saldo inicial',
  },
  deposit: {
    title: 'Ingresar efectivo',
    description:
      'Guardar efectivo en la caja no es un ingreso: el dinero ya era tuyo. Solo cambia de sitio.',
    submit: 'Guardar ingreso',
  },
  withdrawal: {
    title: 'Retirar efectivo',
    description:
      'Sacar efectivo de la caja no es un gasto: registra el gasto más adelante cuando lo uses.',
    submit: 'Guardar retirada',
  },
};

const formSchema = z.object({
  amount: z.coerce
    .number()
    .positive('La cantidad debe ser mayor a 0')
    .max(999_999_999.99, 'La cantidad es demasiado grande'),
  movementDate: z.string().min(1, 'La fecha es requerida'),
  note: z.string().max(255, 'Máximo 255 caracteres').optional(),
});

type FormValues = z.infer<typeof formSchema>;

/** "12,5" -> "12.5", one decimal separator, at most 2 decimals. */
function sanitizeAmount(raw: string) {
  const cleaned = raw.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const [int = '', ...rest] = cleaned.split('.');
  if (rest.length === 0) return int.slice(0, 9);
  return `${int.slice(0, 9)}.${rest.join('').slice(0, 2)}`;
}

function todayInputValue(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().split('T')[0];
}

export function SafeboxMovementForm({
  mode,
  onDone,
}: {
  mode: SafeboxMovementFormMode;
  onDone: (saved: boolean) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const copy = MODE_COPY[mode];

  const form = useForm<FormValues>({
    // z.coerce.number() types the raw amount as unknown; the field keeps the
    // sanitized string while typing, same contract as the finance form.
    resolver: zodResolver(formSchema) as unknown as Resolver<FormValues>,
    defaultValues: {
      amount: 0,
      movementDate: todayInputValue(),
      note: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      await createSafeboxMovement({
        movementType: mode,
        amount: values.amount,
        note: values.note?.trim() ? values.note.trim() : null,
        movementDate: new Date(values.movementDate).toISOString(),
      });
      onDone(true);
    } catch (error) {
      setServerError(
        error instanceof SafeboxRequestError
          ? error.message
          : 'No se pudo guardar el movimiento.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="text-[20px] font-bold tracking-[-0.02em]">{copy.title}</h2>
      <p className="mt-1 text-[13px] leading-snug text-subtle">
        {copy.description}
      </p>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="mt-5 space-y-4"
        >
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => {
              // The schema types it as a number, but while typing it holds
              // the raw sanitized string ("12.5"); show it with a comma.
              const raw = field.value as number | string;
              const shown =
                raw === 0 || Number.isNaN(raw)
                  ? ''
                  : String(raw).replace('.', ',');
              return (
                <FormItem>
                  <FormLabel>Cantidad</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={shown}
                      onChange={(event) =>
                        field.onChange(sanitizeAmount(event.target.value))
                      }
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      autoComplete="off"
                      className="num"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="movementDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha</FormLabel>
                <FormControl>
                  <Input {...field} type="date" max={todayInputValue()} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nota (opcional)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="text"
                    placeholder={
                      mode === 'withdrawal'
                        ? 'P. ej. a la cartera'
                        : 'P. ej. del cajero'
                    }
                    maxLength={255}
                    autoComplete="off"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {serverError && (
            <p role="alert" className="text-[13px] text-negative">
              {serverError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onDone(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando…' : copy.submit}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
