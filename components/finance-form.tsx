'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  ReceiptText,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { z } from 'zod';

import { buildReceiptSubmitContext } from '@/components/ai/receiptSubmitContext';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { createEntry, updateEntry } from '@/lib/actions';
import type { Entry } from '@/lib/definitions';
import { logger } from '@/lib/logger';
import { cn, formatCurrency, shouldSplitTransaction } from '@/lib/utils';

const formSchema = z.object({
  fecha: z.string().min(1, { message: 'La fecha es requerida' }),
  hora: z.coerce
    .number()
    .min(0)
    .max(23, { message: 'La hora debe estar entre 0 y 23' }),
  minuto: z.coerce
    .number()
    .min(0)
    .max(59, { message: 'El minuto debe estar entre 0 y 59' }),
  tipo: z.string().min(1, { message: 'El tipo es requerido' }),
  accion: z.string().min(1, { message: 'La acción es requerida' }),
  que: z.string().min(1, { message: "El campo 'Qué' es requerido" }),
  plataforma_pago: z
    .string()
    .min(1, { message: 'La plataforma de pago es requerida' }),
  cantidad: z.coerce
    .number()
    .min(0.01, { message: 'La cantidad debe ser mayor a 0' }),
  detalle1: z.string().optional(),
  detalle2: z.string().optional(),
  quien: z.string().min(1, { message: 'El pagador es requerido' }),
});

type FinanceFormValues = z.infer<typeof formSchema>;

// Pre-filled data from AI parsing
interface ParsedData {
  fecha?: string;
  hora?: number;
  minuto?: number;
  tipo?: string;
  accion?: string;
  que?: string;
  plataforma_pago?: string;
  cantidad?: number;
  detalle1?: string;
  detalle2?: string;
  quien?: string;
  ai_text?: string;
  ai_provider?: string;
  ai_model?: string;
  ai_cost?: number;
  ai_paid?: boolean;
  // Receipt provenance, from `/new?rcpt=1`
  rcpt?: string;
  content_hash?: string;
  merchant_id?: string;
  confianza?: number;
  comercio?: string;
  needs_review?: boolean;
}

interface FinanceFormProps {
  entry?: Entry;
  parsedData?: ParsedData;
}

export function FinanceForm({ entry, parsedData }: FinanceFormProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [tipoOptions, setTipoOptions] = useState<string[]>([]);
  const [queOptions, setQueOptions] = useState<string[]>([]);
  const [plataformaOptions, setPlataformaOptions] = useState<string[]>([]);
  const [quienOptions, setQuienOptions] = useState<string[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch dynamic options on mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await fetch('/api/options');
        if (response.ok) {
          const data = await response.json();
          setTipoOptions(data.tipo);
          setQueOptions(data.que);
          setPlataformaOptions(data.plataforma_pago);
          setQuienOptions(data.quien ?? ['Yo']);
        }
      } catch (error) {
        console.error('Failed to fetch options:', error);
        // Keep empty arrays on error
      } finally {
        setOptionsLoading(false);
      }
    };

    fetchOptions();
  }, []);

  // Build default values based on entry or parsedData
  const getDefaultValues = (): FinanceFormValues => {
    const now = new Date();

    if (entry) {
      // Use the existing date when editing
      return {
        fecha: new Date(entry.fecha).toISOString().split('T')[0],
        hora: new Date(entry.fecha).getHours(),
        minuto: new Date(entry.fecha).getMinutes(),
        tipo: entry.tipo || '',
        accion: entry.accion || '',
        que: entry.que || '',
        plataforma_pago: entry.plataforma_pago || '',
        cantidad: shouldSplitTransaction(
          entry.plataforma_pago,
          entry.detalle1,
          entry.accion,
        )
          ? entry.cantidad * 2
          : entry.cantidad,
        detalle1: entry.detalle1 ?? '',
        detalle2: entry.detalle2 ?? '',
        quien: entry.quien || 'Yo',
      };
    }

    if (parsedData) {
      // Use AI-parsed data
      return {
        fecha: parsedData.fecha ?? now.toISOString().split('T')[0],
        hora: parsedData.hora ?? now.getHours(),
        minuto: parsedData.minuto ?? now.getMinutes(),
        tipo: parsedData.tipo ?? '',
        accion: parsedData.accion ?? '',
        que: parsedData.que ?? '',
        plataforma_pago: parsedData.plataforma_pago ?? '',
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- cantidad can be NaN (parseFloat of query params); || falls back to 0
        cantidad: parsedData.cantidad || 0,
        detalle1: parsedData.detalle1 ?? '',
        detalle2: parsedData.detalle2 ?? '',
        quien: parsedData.quien ?? 'Yo',
      };
    }

    // Default empty form
    return {
      fecha: now.toISOString().split('T')[0],
      hora: now.getHours(),
      minuto: now.getMinutes(),
      tipo: '',
      accion: '',
      que: '',
      plataforma_pago: '',
      cantidad: 0,
      detalle1: '',
      detalle2: '',
      quien: 'Yo',
    };
  };

  const form = useForm<FinanceFormValues>({
    resolver: zodResolver(formSchema) as unknown as Resolver<FinanceFormValues>,
    defaultValues: getDefaultValues(),
  });

  // Update form when parsedData changes (in case it arrives after mount)
  useEffect(() => {
    if (parsedData && !entry) {
      const now = new Date();
      form.reset({
        fecha: parsedData.fecha ?? now.toISOString().split('T')[0],
        hora: parsedData.hora ?? now.getHours(),
        minuto: parsedData.minuto ?? now.getMinutes(),
        tipo: parsedData.tipo ?? '',
        accion: parsedData.accion ?? '',
        que: parsedData.que ?? '',
        plataforma_pago: parsedData.plataforma_pago ?? '',
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- cantidad can be NaN (parseFloat of query params); || falls back to 0
        cantidad: parsedData.cantidad || 0,
        detalle1: parsedData.detalle1 ?? '',
        detalle2: parsedData.detalle2 ?? '',
        quien: parsedData.quien ?? 'Yo',
      });
    }
  }, [parsedData, entry, form]);

  const plataformaPago = useWatch({
    control: form.control,
    name: 'plataforma_pago',
  });
  const detalle1 = useWatch({ control: form.control, name: 'detalle1' });
  const accion = useWatch({ control: form.control, name: 'accion' });
  const minuto = useWatch({ control: form.control, name: 'minuto' });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    // Combine date and time into a single ISO string
    const dateWithTime = new Date(values.fecha);
    dateWithTime.setHours(values.hora, values.minuto);

    // Create a new object without hora and minuto properties
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hora, minuto, ...otherValues } = values;
    const formattedValues = {
      ...otherValues,
      fecha: dateWithTime.toISOString(),
    };

    // For joyntlanda transactions, the entered cantidad is the total, so save half as my part
    if (
      shouldSplitTransaction(
        formattedValues.plataforma_pago,
        formattedValues.detalle1,
        formattedValues.accion,
      )
    ) {
      formattedValues.cantidad /= 2;
    }

    logger.info('FECHA:', formattedValues.fecha);

    setSaveError(null);

    if (!session?.user.id) {
      setSaveError('Tu sesión ha caducado. Vuelve a iniciar sesión.');
      return;
    }

    const { provenance, learning } = buildReceiptSubmitContext(parsedData);

    try {
      if (entry) {
        // Provenance is write-once at insert. `updateEntry` does not store
        // it (Task 11 leaves it untouched), and an edit months later is not a
        // statement about the receipt that produced the entry.
        await updateEntry(entry.id, formattedValues, {
          user: { id: session.user.id },
        });
      } else {
        await createEntry(
          { ...formattedValues, ...provenance },
          { user: { id: session.user.id } },
          learning,
        );
      }
    } catch (error) {
      logger.error('Failed to save entry:', error);
      setSaveError(
        'No se ha podido guardar. Revisa tu conexión e inténtalo otra vez.',
      );
      return;
    }
    router.push('/records');
    router.refresh();
  }

  const split = shouldSplitTransaction(plataformaPago, detalle1, accion);
  const isSubmitting = form.formState.isSubmitting;
  const isReceipt = parsedData?.rcpt === '1';
  const showProvenance =
    Boolean(parsedData?.ai_text) ||
    isReceipt ||
    Boolean(parsedData?.needs_review);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="space-y-5 md:space-y-6"
      >
        {showProvenance && parsedData && (
          <ProvenanceCard data={parsedData} isReceipt={isReceipt} />
        )}

        {/* Amount + movement: the one big number on this screen. */}
        <section className="pb-1 pt-2 md:rounded-[20px] md:border md:border-hairline md:bg-surface md:px-6 md:pb-6 md:pt-7">
          <FormField
            control={form.control}
            name="cantidad"
            render={({ field }) => {
              // The schema types it as a number, but while typing it holds
              // the raw string ("12."), and an entry from the API is a string.
              const raw = field.value as number | string;
              const shown = raw === 0 ? '' : String(raw).replace('.', ',');
              const amount = Number(String(field.value).replace(',', '.'));
              return (
                <FormItem className="space-y-0 text-center">
                  <FormLabel className="text-[13px] font-medium text-subtle">
                    {split ? 'Importe total' : 'Cantidad'}
                  </FormLabel>
                  <div className="group mt-3 flex flex-col items-center">
                    <div className="flex max-w-full items-baseline justify-center">
                      {/* The invisible twin sizes the input to its text, so
                          the number and the euro sign stay centred together. */}
                      <span className="display-num relative inline-block min-w-0 text-[52px] font-semibold md:text-[60px]">
                        <span aria-hidden className="invisible whitespace-pre">
                          {shown || '0'}
                        </span>
                        <FormControl>
                          <input
                            {...field}
                            value={shown}
                            onChange={(e) =>
                              field.onChange(sanitizeAmount(e.target.value))
                            }
                            type="text"
                            inputMode="decimal"
                            size={1}
                            autoComplete="off"
                            enterKeyHint="next"
                            placeholder="0"
                            className="absolute inset-0 w-full min-w-0 bg-transparent p-0 text-foreground caret-primary outline-none placeholder:text-faint"
                          />
                        </FormControl>
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          'display-num ml-1.5 text-[30px] font-medium md:text-[34px]',
                          shown ? 'text-subtle' : 'text-faint',
                        )}
                      >
                        €
                      </span>
                    </div>
                    <div className="mt-3 h-px w-24 bg-hairline-strong transition-colors group-focus-within:bg-subtle" />
                  </div>
                  {split && amount > 0 && (
                    <p className="mt-3 text-[13px] text-subtle">
                      Gasto compartido: se guardará tu mitad,{' '}
                      <span className="num font-semibold text-foreground">
                        {formatCurrency(amount / 2)}
                      </span>
                    </p>
                  )}
                  <FormMessage className="mt-2 text-[13px] text-negative" />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="accion"
            render={({ field }) => (
              <FormItem className="mx-auto mt-6 max-w-md space-y-0">
                <div
                  role="radiogroup"
                  aria-label="Acción"
                  className="grid h-11 grid-cols-3 rounded-[14px] bg-surface-2 p-[3px]"
                >
                  {ACCIONES.map(({ value, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={field.value === value}
                      onClick={() => field.onChange(value)}
                      className={cn(
                        'flex items-center justify-center gap-1.5 rounded-[11px] text-[14px] font-semibold tracking-[-0.01em] transition-colors',
                        field.value === value
                          ? 'bg-foreground text-background'
                          : 'text-subtle hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2.2} />
                      {value}
                    </button>
                  ))}
                </div>
                <FormMessage className="mt-2 text-center text-[13px] text-negative" />
              </FormItem>
            )}
          />
        </section>

        {/* Details */}
        <section className="grid grid-cols-2 gap-x-3 gap-y-4 rounded-[20px] border border-hairline bg-surface p-4 md:gap-x-4 md:gap-y-5 md:p-6">
          <FormField
            control={form.control}
            name="que"
            render={({ field }) => (
              <FormItem
                className={cn(FIELD, 'col-span-2 md:order-1 md:col-span-1')}
              >
                <FormLabel className={LABEL}>Qué</FormLabel>
                <FormControl>
                  <Combobox
                    options={queOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Seleccionar qué..."
                    loading={optionsLoading}
                  />
                </FormControl>
                <FormMessage className={MESSAGE} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tipo"
            render={({ field }) => (
              <FormItem
                className={cn(FIELD, 'col-span-2 md:order-2 md:col-span-1')}
              >
                <FormLabel className={LABEL}>Categoría</FormLabel>
                <FormControl>
                  <Combobox
                    options={tipoOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Seleccionar categoría..."
                    loading={optionsLoading}
                  />
                </FormControl>
                <FormMessage className={MESSAGE} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="plataforma_pago"
            render={({ field }) => (
              <FormItem
                className={cn(FIELD, 'col-span-2 md:order-3 md:col-span-1')}
              >
                <FormLabel className={LABEL}>Plataforma de pago</FormLabel>
                <FormControl>
                  <Combobox
                    options={plataformaOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Seleccionar plataforma..."
                    loading={optionsLoading}
                  />
                </FormControl>
                <FormMessage className={MESSAGE} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fecha"
            render={({ field }) => (
              <FormItem className={cn(FIELD, 'col-span-1 md:order-5')}>
                <FormLabel className={LABEL}>Fecha</FormLabel>
                <FormControl>
                  <Input type="date" {...field} className={INPUT} />
                </FormControl>
                <FormMessage className={MESSAGE} />
              </FormItem>
            )}
          />

          {/* One time input for the two schema fields `hora` and `minuto`. */}
          <FormField
            control={form.control}
            name="hora"
            render={({ field }) => (
              <FormItem className={cn(FIELD, 'col-span-1 md:order-6')}>
                <FormLabel className={LABEL}>Hora</FormLabel>
                <FormControl>
                  <Input
                    type="time"
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={`${pad(field.value)}:${pad(minuto)}`}
                    onChange={(e) => {
                      // A cleared time input reports ''; keep the last time.
                      if (!e.target.value) return;
                      const [h, m] = e.target.value.split(':');
                      field.onChange(Number(h));
                      form.setValue('minuto', Number(m), {
                        shouldDirty: true,
                      });
                    }}
                    className={INPUT}
                  />
                </FormControl>
                <FormMessage className={MESSAGE} />
                {form.formState.errors.minuto && (
                  <p className={MESSAGE}>
                    {form.formState.errors.minuto.message}
                  </p>
                )}
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="quien"
            render={({ field }) => (
              <FormItem
                className={cn(FIELD, 'col-span-2 md:order-4 md:col-span-1')}
              >
                <FormLabel className={LABEL}>Quién</FormLabel>
                <FormControl>
                  <Combobox
                    options={quienOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Seleccionar quién pagó..."
                    loading={optionsLoading}
                  />
                </FormControl>
                <FormMessage className={MESSAGE} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="detalle1"
            render={({ field }) => (
              <FormItem
                className={cn(FIELD, 'col-span-2 md:order-7 md:col-span-1')}
              >
                <FormLabel className={LABEL}>Nota</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Opcional"
                    autoComplete="off"
                    maxLength={255}
                    className={INPUT}
                  />
                </FormControl>
                <FormMessage className={MESSAGE} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="detalle2"
            render={({ field }) => (
              <FormItem
                className={cn(FIELD, 'col-span-2 md:order-8 md:col-span-1')}
              >
                <FormLabel className={LABEL}>Nota 2</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Opcional"
                    autoComplete="off"
                    maxLength={255}
                    className={INPUT}
                  />
                </FormControl>
                <FormMessage className={MESSAGE} />
              </FormItem>
            )}
          />
        </section>

        {saveError && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-[14px] border border-negative/30 bg-negative/10 px-4 py-3 text-[13px] font-medium text-negative"
          >
            <AlertCircle className="mt-px h-4 w-4 shrink-0" />
            {saveError}
          </p>
        )}

        {/* Room for the fixed action bar on mobile. */}
        <div aria-hidden className="h-6 md:hidden" />

        <div
          className={cn(
            'glass fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-[45] flex gap-3 border-t border-hairline px-4 py-3',
            'md:static md:z-auto md:justify-end md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none',
          )}
        >
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
            className="h-12 px-5 md:h-11"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-12 flex-1 text-[15px] md:h-11 md:flex-none md:px-8 md:text-sm"
          >
            {isSubmitting && <Loader2 className="animate-spin" />}
            {entry ? 'Actualizar' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

const FIELD = 'space-y-1.5';
const LABEL = 'text-[13px] font-medium text-subtle';
const MESSAGE = 'text-[13px] font-medium text-negative';
const INPUT = 'text-[15px] md:text-[15px]';

const ACCIONES = [
  { value: 'Gasto', icon: ArrowUpRight },
  { value: 'Ingreso', icon: ArrowDownLeft },
  { value: 'Inversión', icon: TrendingUp },
] as const;

/** "12,5" -> "12.5": one decimal separator, at most two decimals. */
function sanitizeAmount(raw: string) {
  const cleaned = raw.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const [int = '', ...rest] = cleaned.split('.');
  if (rest.length === 0) return int.slice(0, 9);
  return `${int.slice(0, 9)}.${rest.join('').slice(0, 2)}`;
}

function pad(n: number | string | undefined) {
  const v = Number(n);
  return String(Number.isFinite(v) ? v : 0).padStart(2, '0');
}

function ProvenanceCard({
  data,
  isReceipt,
}: {
  data: ParsedData;
  isReceipt: boolean;
}) {
  const Icon = isReceipt ? ReceiptText : Sparkles;
  const model = [data.ai_provider, data.ai_model].filter(Boolean).join(' / ');
  const source = data.ai_text
    ? `“${data.ai_text}”`
    : isReceipt
      ? [
          data.comercio,
          data.confianza !== undefined
            ? `confianza ${Math.round(data.confianza * 100)}%`
            : undefined,
        ]
          .filter(Boolean)
          .join(' · ')
      : '';

  return (
    <section
      aria-label="Origen de los datos"
      className="rounded-[20px] border border-hairline bg-surface p-4"
    >
      <div className="flex gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-subtle">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[15px] font-semibold tracking-[-0.01em]">
              {isReceipt ? 'Leído de un recibo' : 'Leído por IA'}
            </p>
            {model && (
              <span className="truncate rounded-lg bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-subtle">
                {model}
              </span>
            )}
          </div>
          {source && (
            <p className="mt-0.5 line-clamp-3 break-words text-[13px] text-subtle">
              {source}
            </p>
          )}
          <p className="mt-1.5 text-[12px] text-faint">
            Revisa los datos antes de guardar
            {data.ai_paid && (
              <>
                {' · '}
                <span className="num">
                  coste ${data.ai_cost?.toFixed(4) ?? '0.0000'}
                </span>
              </>
            )}
          </p>
        </div>
      </div>
      {/* A receipt with a fuzzy amount is a different situation from a
          clean read: it gets its own line, flagged but not alarming. */}
      {data.needs_review && (
        <p
          role="status"
          className="mt-3 flex items-start gap-2 border-t border-hairline pt-3 text-[13px] font-medium text-foreground"
        >
          <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-negative" />
          La IA no estaba segura del importe. Revísalo antes de guardar.
        </p>
      )}
    </section>
  );
}
