'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { z } from 'zod';

import { FinanceForm } from '@/components/finance-form';
import { PageHeader } from '@/components/page-header';
import { normalizeCategory } from '@/lib/categories';

/**
 * Every value on this page arrives in a query string, so all of it is
 * user-supplied — including the parts a parse route produced, which the user
 * can trivially edit. Each one is therefore normalised here, before it can
 * reach a database write: the category is canonicalised, the text is bounded
 * to the widest column on `finance_entries`, and the receipt provenance is
 * held to the shape `app/api/ai/parse-receipt` can actually emit.
 */

/** `VARCHAR(255)` is the widest text column on the row; longer is a 500. */
const MAX_TEXT = 255;

/** SHA-256 of the uploaded bytes, lowercase hex, as the route emits it. */
const contentHashSchema = z.string().regex(/^[0-9a-f]{64}$/);

/** `merchants.id` is a UUID and `finance_entries.merchant_id` a FK to it. */
const merchantIdSchema = z.uuid();

/** `''`, whitespace and an absent param all mean "not provided". */
function textParam(raw: string | null): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_TEXT);
}

/** The same category the API path would store, so a receipt cannot drift. */
function categoryParam(raw: string | null): string | undefined {
  const text = textParam(raw);
  return text ? normalizeCategory(text) : undefined;
}

/** The `<input type="date">` value; anything else falls back to today. */
function dayParam(raw: string | null): string | undefined {
  const text = textParam(raw);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  return Number.isNaN(new Date(text).getTime()) ? undefined : text;
}

function intParam(
  raw: string | null,
  min: number,
  max: number,
): number | undefined {
  const parsed = parseInt(raw ?? '', 10);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : undefined;
}

/** `NaN` never prefills the form; the form's own schema still bounds it. */
function numberParam(raw: string | null): number | undefined {
  const parsed = parseFloat(raw ?? '');
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * `confianza` is the one number the form's zod schema never sees: it is
 * merged in *after* that parse, so `?confianza=abc` would otherwise be stored
 * as `NaN`, which `numeric` happily accepts. Clamped and rounded to
 * `NUMERIC(3, 2)`, exactly like the route clamps the model's own value.
 */
function confidenceParam(raw: string | null): number | undefined {
  const parsed = numberParam(raw);
  return parsed === undefined
    ? undefined
    : Math.round(Math.min(1, Math.max(0, parsed)) * 100) / 100;
}

function shape<T>(schema: z.ZodType<T>, value: T | undefined): T | undefined {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function NewEntryContent() {
  const searchParams = useSearchParams();

  // `rcpt` is set only by the receipt flow. It is the single marker that
  // turns a visit into a confirmation, and it is checked as exactly `'1'`
  // everywhere it is read — anything else is a hand-edited URL.
  const isReceipt = searchParams.get('rcpt') === '1';

  // AI-parsed data, from either a text prompt or a receipt upload.
  const hasAiData = searchParams.has('ai_text') || searchParams.has('rcpt');

  // Build parsedData object from query params if AI data exists
  const parsedData = hasAiData
    ? {
        fecha: dayParam(searchParams.get('fecha')),
        hora: intParam(searchParams.get('hora'), 0, 23),
        minuto: intParam(searchParams.get('minuto'), 0, 59),
        tipo: categoryParam(searchParams.get('tipo')),
        // A receipt is an expense. The category proposal is allowed to fill
        // `tipo`, but `accion` is a fact of the flow rather than a reading, so
        // it is not read from the URL on this path: `?rcpt=1&accion=Ingreso`
        // must not turn a photographed receipt into income.
        accion: isReceipt
          ? 'Gasto'
          : // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty query params must normalize to undefined
            searchParams.get('accion') || undefined,
        que: textParam(searchParams.get('que')),
        plataforma_pago: textParam(searchParams.get('plataforma_pago')),
        cantidad: numberParam(searchParams.get('cantidad')),
        detalle1: textParam(searchParams.get('detalle1')),
        detalle2: textParam(searchParams.get('detalle2')),
        ai_text: textParam(searchParams.get('ai_text')),
        ai_provider: textParam(searchParams.get('ai_provider')),
        ai_model: textParam(searchParams.get('ai_model')),
        ai_cost: numberParam(searchParams.get('ai_cost')),
        ai_paid: searchParams.get('ai_paid') === 'true',
        // Receipt provenance. `rcpt` is the marker that turns a plain visit
        // into a confirmation flow, and `comercio` is the only input the
        // learning write needs; the category always comes from the form.
        rcpt: textParam(searchParams.get('rcpt')),
        content_hash: shape(
          contentHashSchema,
          textParam(searchParams.get('content_hash')),
        ),
        merchant_id: shape(
          merchantIdSchema,
          textParam(searchParams.get('merchant_id')),
        ),
        confianza: confidenceParam(searchParams.get('confianza')),
        comercio: textParam(searchParams.get('comercio')),
        needs_review: searchParams.get('needs_review') === '1',
      }
    : undefined;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title={hasAiData ? 'Revisar entrada' : 'Nuevo registro'} />
      <FinanceForm parsedData={parsedData} />
    </div>
  );
}

export default function NewEntryPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-2xl">
          <PageHeader title="Nuevo registro" />
          <p className="text-[13px] text-subtle">Cargando...</p>
        </div>
      }
    >
      <NewEntryContent />
    </Suspense>
  );
}
