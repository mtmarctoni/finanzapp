import { generateObject } from 'ai';
import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { raceFreeProviders } from '@/lib/ai/fallback';
import { RECEIPT_PARSE_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/ai/rate-limit';
import { logger } from '@/lib/logger';
import { recordMerchantSeen } from '@/lib/merchants/repo';
import {
  findEntryByContentHash,
  findSimilarReceiptEntry,
  type ReceiptCandidate,
} from '@/lib/receipts/dedupe';
import {
  ReceiptImageError,
  toDataUrl,
  validateImageUpload,
} from '@/lib/receipts/image';
import { resolveMerchantClassification } from '@/lib/receipts/resolve';

/**
 * The facts read off a receipt image. Nothing else: no category decision, no
 * `accion` (a receipt is an expense), no `que` (the merchant name is that).
 *
 * `cantidad` is `nonnegative` rather than `positive` so that an unreadable
 * total comes back as a *successful read of a zero* and the route can answer
 * with a field-level error, instead of every model throwing and the whole
 * request degrading to `503`.
 */
export const receiptFactsSchema = z.object({
  fecha: z.string().describe('Fecha de la compra en formato YYYY-MM-DD'),
  cantidad: z
    .number()
    .nonnegative()
    .describe('Importe total pagado, siempre positivo (12.5)'),
  comercio: z.string().describe('Nombre del comercio tal como aparece'),
  tipo: z
    .string()
    .describe(
      'Categoría de gasto propuesta, de la lista del prompt. El servidor la normaliza y la memoria del usuario tiene prioridad.',
    ),
  plataforma_pago: z
    .string()
    .describe('Método de pago impreso; cadena vacía si no aparece'),
  detalle1: z
    .string()
    .describe('Descripción corta de lo comprado; cadena vacía si no se lee'),
  confianza: z
    .number()
    .min(0)
    .max(1)
    .describe('Confianza entre 0 y 1 en la lectura del importe'),
});

/** Images cost more than text, so the budget is tighter than parse-for-form. */
const RATE_LIMIT_CONFIG = { maxRequests: 3, windowMs: 60 * 1000 };

/** Below this the form is pre-filled but flagged for the user to check. */
const LOW_CONFIDENCE = 0.5;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  const session = await getServerSession(authOptions);
  if (!session?.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const userId = session.user.id;

  const rateLimitResult = await checkRateLimit(
    `parse-receipt:${userId}`,
    RATE_LIMIT_CONFIG,
  );
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: 'Límite de solicitudes excedido',
        message: `Demasiadas imágenes. Inténtalo de nuevo en ${rateLimitResult.retryAfter} segundos.`,
        retryAfter: rateLimitResult.retryAfter,
      },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimitResult),
      },
    );
  }

  const headers = getRateLimitHeaders(rateLimitResult);
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return NextResponse.json(
      { error: 'Se requiere un envío multipart/form-data con el campo image.' },
      { status: 415, headers },
    );
  }

  let image: Awaited<ReturnType<typeof validateImageUpload>>;
  try {
    const formData = await request.formData();
    const field = formData.get('image');
    if (!(field instanceof File)) {
      return NextResponse.json(
        { error: "Se requiere un archivo en el campo 'image'." },
        { status: 400, headers },
      );
    }
    image = await validateImageUpload(field);
  } catch (error) {
    if (error instanceof ReceiptImageError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode, headers },
      );
    }
    logger.error(`[Parse Receipt] Guard error ${requestId}`, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'No se pudo leer el archivo.' },
      { status: 400, headers },
    );
  }

  // The cheapest possible answer: this exact image is already stored. This
  // lookup deliberately runs BEFORE the model race — a re-upload costs zero
  // model calls, which is the entire reason the bytes were hashed first.
  const exact = await findEntryByContentHash(image.contentHash, userId);
  if (exact) {
    logger.info(`[Parse Receipt] Exact duplicate ${requestId}`, {
      userId,
      entryId: exact.id,
    });
    return NextResponse.json(
      { success: true, duplicate: true, duplicateKind: 'exact', entry: exact },
      { headers },
    );
  }

  logger.info(`[Parse Receipt Start] ${requestId}`, {
    userId,
    mediaType: image.mediaType,
    bytes: image.byteLength,
  });

  const freeResult = await raceFreeProviders(
    async (model) => {
      const result = await generateObject({
        model,
        schema: receiptFactsSchema,
        system: RECEIPT_PARSE_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extrae los datos de este recibo.',
              },
              {
                type: 'image',
                image: toDataUrl(image),
                mediaType: image.mediaType,
              },
            ],
          },
        ],
        maxRetries: 1,
      });

      return {
        result: { facts: result.object },
        usage: {
          inputTokens: result.usage.inputTokens ?? 0,
          outputTokens: result.usage.outputTokens ?? 0,
        },
      };
    },
    { endpoint: '/api/ai/parse-receipt', visionOnly: true },
  );

  if (!freeResult.success) {
    logger.warn(`[Parse Receipt] All vision models failed ${requestId}`, {
      userId,
      attempts: freeResult.attempts,
    });
    return NextResponse.json(
      {
        success: false,
        error: 'No hemos podido leer la imagen con ningún modelo disponible.',
        message: 'Prueba con una foto más nítida o escribe la entrada a mano.',
        modelErrors: freeResult.attempts,
      },
      { status: 503, headers },
    );
  }

  const facts = freeResult.result.facts;

  // A successful read is not a usable read. An unreadable total must never
  // reach the form, where it would be saved as a 0 expense.
  if (!Number.isFinite(facts.cantidad) || facts.cantidad <= 0) {
    return NextResponse.json(
      {
        success: false,
        field: 'cantidad',
        error: 'No se ha podido leer el importe.',
        message:
          'Haz una foto más cerca del total, o con mejor luz, e inténtalo de nuevo.',
      },
      { status: 422, headers },
    );
  }

  const comercio = facts.comercio.trim();
  if (!comercio) {
    return NextResponse.json(
      {
        success: false,
        field: 'comercio',
        error: 'No se ha podido leer el comercio.',
        message:
          'Haz una foto donde se vea el nombre del comercio, e inténtalo de nuevo.',
      },
      { status: 422, headers },
    );
  }

  const now = new Date();
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(facts.fecha.trim())
    ? facts.fecha.trim()
    : now.toISOString().split('T')[0];

  const candidate: ReceiptCandidate = {
    fecha,
    hora: now.getHours(),
    minuto: now.getMinutes(),
    comercio,
    cantidad: facts.cantidad,
    plataforma_pago: facts.plataforma_pago.trim(),
  };

  const similar = await findSimilarReceiptEntry(candidate, userId);
  if (similar) {
    logger.info(`[Parse Receipt] Similar duplicate ${requestId}`, {
      userId,
      entryId: similar.entry.id,
      score: similar.score,
    });
    return NextResponse.json(
      {
        success: true,
        duplicate: true,
        duplicateKind: 'similar',
        entry: similar.entry,
      },
      { headers },
    );
  }

  const classification = await resolveMerchantClassification({
    userId,
    comercio,
    modelTipo: facts.tipo,
    modelPlataformaPago: facts.plataforma_pago,
  });

  // Best-effort: a failed write must not cost the user their parse. When it
  // does succeed, its id is what the saved entry points at — the classification
  // could not know it, because on a first sighting the row did not exist yet.
  let merchantId = classification.merchantId;
  try {
    const seen = await recordMerchantSeen(
      userId,
      comercio,
      classification.tipo,
      classification.plataforma_pago,
    );
    merchantId = seen.id;
  } catch (error) {
    logger.warn(`[Parse Receipt] Merchant write failed ${requestId}`, {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  const confianza = Math.min(1, Math.max(0, facts.confianza));

  logger.info(`[Parse Receipt Success] ${requestId}`, {
    userId,
    provider: freeResult.provider,
    model: freeResult.model,
    categorySource: classification.source,
    durationMs: Date.now() - startTime,
  });

  return NextResponse.json(
    {
      success: true,
      duplicate: false,
      contentHash: image.contentHash,
      parsedData: {
        fecha,
        hora: now.getHours(),
        minuto: now.getMinutes(),
        tipo: classification.tipo,
        accion: 'Gasto',
        que: comercio,
        // Placeholder only. The column is NOT NULL and the form requires a
        // value, so the prefill cannot stay empty — but the truth is reported
        // in `receipt.plataforma_pago` so the UI can say it was not read.
        // `||`, not `??`: `''` here means "not printed on the receipt" and
        // must fall through to the placeholder. The rule does not ask for
        // `??` here because the operand is a plain, non-nullable `string`.
        plataforma_pago: classification.plataforma_pago || 'Efectivo',
        cantidad: facts.cantidad,
        detalle1: facts.detalle1.trim(),
        detalle2: '',
        merchant_id: merchantId ?? undefined,
      },
      receipt: {
        contentHash: image.contentHash,
        confianza,
        needsReview: confianza < LOW_CONFIDENCE,
        comercio,
        categorySource: classification.source,
        merchantId,
        /** What was actually known — `''` when neither ticket nor memory had it. */
        plataforma_pago: classification.plataforma_pago,
      },
      providerUsed: freeResult.provider,
      modelUsed: freeResult.model,
    },
    {
      headers: {
        ...headers,
        'X-Provider-Used': freeResult.provider,
        'X-Model-Used': freeResult.model,
      },
    },
  );
}
