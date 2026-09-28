/** @jest-environment node */

import { generateObject } from 'ai';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { POST } from '@/app/api/ai/parse-receipt/route';
import { raceFreeProviders } from '@/lib/ai/fallback';
import { checkRateLimit } from '@/lib/ai/rate-limit';
import { recordMerchantSeen } from '@/lib/merchants/repo';
import {
  findEntryByContentHash,
  findSimilarReceiptEntry,
} from '@/lib/receipts/dedupe';
import { resolveMerchantClassification } from '@/lib/receipts/resolve';

// `jest.mock('next-auth')` is a bare automock on purpose, and the auth route
// module is deliberately NOT mocked:
//
// - A factory returning only `getServerSession` deletes the module's default
//   export, and `@/app/api/auth/[...nextauth]/route` calls `NextAuth(...)` at
//   module scope while this route imports `authOptions` from it. The suite dies
//   with "(0 , _nextauth.default) is not a function".
// - `jest.config.mjs` maps `@/components`, `@/hooks` and `@/lib` but has no
//   `^@/app/*` entry, so a `jest.mock('@/app/api/auth/[...nextauth]/route')`
//   argument cannot be resolved at all — SWC rewrites *import specifiers*,
//   never `jest.mock()` path strings. Loading the real module works because the
//   specifier inside `route.ts` is rewritten. Same approach as
//   `__tests__/api/api-keys.test.ts`.
jest.mock('next-auth');
jest.mock('ai', () => ({ generateObject: jest.fn() }));
jest.mock('@/lib/ai/fallback', () => ({ raceFreeProviders: jest.fn() }));
jest.mock('@/lib/ai/rate-limit', () => ({
  checkRateLimit: jest.fn(),
  getRateLimitHeaders: jest.fn(() => ({ 'X-RateLimit-Limit': '3' })),
}));
jest.mock('@/lib/merchants/repo', () => ({ recordMerchantSeen: jest.fn() }));
jest.mock('@/lib/receipts/dedupe', () => ({
  findEntryByContentHash: jest.fn(),
  findSimilarReceiptEntry: jest.fn(),
}));
jest.mock('@/lib/receipts/resolve', () => ({
  resolveMerchantClassification: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const sessionMock = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const raceMock = raceFreeProviders as jest.MockedFunction<
  typeof raceFreeProviders
>;
const rateLimitMock = checkRateLimit as jest.MockedFunction<
  typeof checkRateLimit
>;
const recordSeenMock = recordMerchantSeen as jest.MockedFunction<
  typeof recordMerchantSeen
>;
const exactMock = findEntryByContentHash as jest.MockedFunction<
  typeof findEntryByContentHash
>;
const similarMock = findSimilarReceiptEntry as jest.MockedFunction<
  typeof findSimilarReceiptEntry
>;
const resolveMock = resolveMerchantClassification as jest.MockedFunction<
  typeof resolveMerchantClassification
>;
const generateMock = generateObject as jest.MockedFunction<
  typeof generateObject
>;

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02, 0x03, 0x04,
]);
const HTML = Buffer.from('<!doctype html><script>alert(1)</script>');

const FACTS = {
  fecha: '2026-09-20',
  cantidad: 43.2,
  comercio: 'Mercadona',
  tipo: 'Supermercado',
  plataforma_pago: 'Visa',
  detalle1: 'Leche y pan',
  confianza: 0.92,
};

function imageFile(bytes: Buffer = PNG, type = 'image/png'): File {
  return new File([new Uint8Array(bytes)], 'receipt.png', { type });
}

function multipartRequest(
  body: FormData | null = null,
  headers: Record<string, string> = {},
): NextRequest {
  const form = body ?? new FormData();
  return new NextRequest('http://localhost/api/ai/parse-receipt', {
    method: 'POST',
    body: form,
    headers,
  });
}

function withImage(bytes: Buffer = PNG, type = 'image/png'): FormData {
  const form = new FormData();
  form.set('image', imageFile(bytes, type));
  return form;
}

/**
 * A body that also carries a `userId` field, as a hostile or careless client
 * would send. The route has no `userId` input, so the field must be inert.
 */
function withImageAndUserId(bytes: Buffer = PNG, userId = 'user-2'): FormData {
  const form = withImage(bytes);
  form.set('userId', userId);
  return form;
}

function succeedWith(facts: Record<string, unknown> = FACTS) {
  generateMock.mockResolvedValue({
    object: facts,
    usage: { inputTokens: 100, outputTokens: 20 },
  } as never);

  // The real race returns a { success, result, provider, model, ... } wrapper,
  // not the operation's own payload. Reproduce that, or every success path in
  // this file would fall through to the 503 branch.
  raceMock.mockImplementation(async (operation) => {
    const outcome = await operation({} as never, {
      provider: 'opencode',
      modelId: 'mimo-v2.5-free',
      name: 'MiMo V2.5 Free',
      timeoutMs: 1,
    });

    return {
      success: true,
      result: outcome.result,
      provider: 'opencode',
      model: 'mimo-v2.5-free',
      costUsd: 0,
      inputTokens: outcome.usage?.inputTokens ?? 0,
      outputTokens: outcome.usage?.outputTokens ?? 0,
    };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  sessionMock.mockResolvedValue({
    user: { id: 'user-1' },
  } as never);
  rateLimitMock.mockResolvedValue({
    allowed: true,
    remaining: 2,
    resetTime: Date.now() + 60_000,
    retryAfter: 60,
  } as never);
  exactMock.mockResolvedValue(null);
  similarMock.mockResolvedValue(null);
  resolveMock.mockResolvedValue({
    tipo: 'Supermercado',
    plataforma_pago: 'Visa',
    source: 'model',
    merchantId: null,
    trusted: false,
  });
  // The real upsert returns the row it touched, and the route stores its id as
  // the entry's merchant_id. A default is required here: a mock resolving to
  // `undefined` would make every success test fail on `seen.id`.
  recordSeenMock.mockResolvedValue({
    id: 'm-1',
    canonical_name: 'Mercadona',
    normalized_name: 'mercadona',
    tipo: 'Supermercado',
    plataforma_pago: 'Visa',
    veces_visto: 1,
    veces_confirmado: 0,
    veces_corregido: 0,
  });
  succeedWith();
});

describe('POST /api/ai/parse-receipt', () => {
  it('rejects an unauthenticated caller', async () => {
    sessionMock.mockResolvedValue(null);
    const res = await POST(multipartRequest(withImage()));
    expect(res.status).toBe(401);
    expect(raceMock).not.toHaveBeenCalled();
  });

  it('rate limits before touching the body', async () => {
    rateLimitMock.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60_000,
      retryAfter: 42,
    } as never);
    const res = await POST(multipartRequest(withImage()));
    expect(res.status).toBe(429);
    expect(generateMock).not.toHaveBeenCalled();
    // The client reads the remaining budget from these headers, on the
    // rejection path as much as on the success path.
    expect(res.headers.get('X-RateLimit-Limit')).toBe('3');
  });

  it('requires a multipart body', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/ai/parse-receipt', {
        method: 'POST',
        body: JSON.stringify({ image: 'nope' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(415);
  });

  it('requires an image field', async () => {
    const res = await POST(multipartRequest(new FormData()));
    expect(res.status).toBe(400);
  });

  // Review Focus #1
  it('rejects an HTML payload that claims to be a PNG', async () => {
    const res = await POST(multipartRequest(withImage(HTML, 'image/png')));
    expect(res.status).toBe(415);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it('rejects an oversized upload with 413', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(4_194_304, 0x41)]);
    const res = await POST(multipartRequest(withImage(big)));
    expect(res.status).toBe(413);
    expect(generateMock).not.toHaveBeenCalled();
  });

  // Review Focus #2
  it('answers an identical re-upload from the hash, without a model call', async () => {
    exactMock.mockResolvedValue({
      id: 'e-1',
      fecha: '2026-09-20',
      tipo: 'Supermercado',
      accion: 'Gasto',
      que: 'Mercadona',
      plataforma_pago: 'Visa',
      cantidad: 43.2,
      detalle1: 'Leche',
      detalle2: null,
      quien: 'Yo',
    });

    const res = await POST(multipartRequest(withImage()));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.duplicate).toBe(true);
    expect(body.duplicateKind).toBe('exact');
    expect(body.entry.id).toBe('e-1');
    expect(generateMock).not.toHaveBeenCalled();
  });

  it('races vision models only', async () => {
    await POST(multipartRequest(withImage()));
    expect(raceMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ visionOnly: true }),
    );
  });

  it('sends the image as a data URL with the detected media type', async () => {
    await POST(multipartRequest(withImage()));
    const call = generateMock.mock.calls[0]?.[0] as {
      messages: {
        content: { type: string; image?: string; mediaType?: string }[];
      }[];
    };
    const parts = call.messages[0]?.content ?? [];
    expect(parts[0]).toEqual({
      type: 'text',
      text: expect.any(String),
    });
    expect(parts[1]?.type).toBe('image');
    expect(parts[1]?.mediaType).toBe('image/png');
    expect(parts[1]?.image).toMatch(/^data:image\/png;base64,/);
  });

  it('returns prefilled form data with the action fixed to Gasto', async () => {
    const res = await POST(multipartRequest(withImage()));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.duplicate).toBe(false);
    expect(body.parsedData).toMatchObject({
      fecha: '2026-09-20',
      tipo: 'Supermercado',
      accion: 'Gasto',
      que: 'Mercadona',
      plataforma_pago: 'Visa',
      cantidad: 43.2,
      detalle1: 'Leche y pan',
    });
    expect(body.receipt.confianza).toBe(0.92);
    expect(body.receipt.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('flags a low-confidence read for review without failing', async () => {
    succeedWith({ ...FACTS, confianza: 0.4 });
    const res = await POST(multipartRequest(withImage()));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.receipt.needsReview).toBe(true);
  });

  // Review Focus #3
  it('refuses to return a zero amount', async () => {
    succeedWith({ ...FACTS, cantidad: 0 });
    const res = await POST(multipartRequest(withImage()));
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.field).toBe('cantidad');
  });

  it('refuses to return an unreadable merchant', async () => {
    succeedWith({ ...FACTS, comercio: '   ' });
    const res = await POST(multipartRequest(withImage()));
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.field).toBe('comercio');
  });

  it('reports a re-photographed receipt as a similar duplicate', async () => {
    similarMock.mockResolvedValue({
      entry: {
        id: 'e-9',
        fecha: '2026-09-20',
        tipo: 'Supermercado',
        accion: 'Gasto',
        que: 'Mercadona',
        plataforma_pago: 'Visa',
        cantidad: 43.2,
        detalle1: null,
        detalle2: null,
        quien: 'Yo',
      },
      score: 1,
    });

    const res = await POST(multipartRequest(withImage()));
    const body = await res.json();
    expect(body.duplicate).toBe(true);
    expect(body.duplicateKind).toBe('similar');
    expect(body.entry.id).toBe('e-9');
  });

  // Every lookup is keyed on the session, never on anything the client sent:
  // the `userId` field below is not part of the contract and must be inert.
  it('scopes the exact-hash lookup to the session user', async () => {
    await POST(multipartRequest(withImageAndUserId()));

    expect(exactMock).toHaveBeenCalledTimes(1);
    expect(exactMock).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f]{64}$/),
      'user-1',
    );
  });

  it('scopes the similar-receipt lookup to the session user', async () => {
    await POST(multipartRequest(withImageAndUserId()));

    expect(similarMock).toHaveBeenCalledTimes(1);
    expect(similarMock).toHaveBeenCalledWith(
      expect.objectContaining({ comercio: 'Mercadona', cantidad: 43.2 }),
      'user-1',
    );
  });

  it('resolves the category in the scope of the authenticated user', async () => {
    await POST(multipartRequest(withImage()));
    expect(resolveMock).toHaveBeenCalledWith({
      userId: 'user-1',
      comercio: 'Mercadona',
      modelTipo: 'Supermercado',
      modelPlataformaPago: 'Visa',
    });
  });

  it('remembers the merchant so the next upload benefits', async () => {
    await POST(multipartRequest(withImage()));
    expect(recordSeenMock).toHaveBeenCalledWith(
      'user-1',
      'Mercadona',
      'Supermercado',
      'Visa',
    );
  });

  // The classification ran before the row existed, so its merchantId is null
  // on a first sighting. The saved entry must still point at the row the
  // upsert created, or provenance is lost exactly when a shop is new.
  it('hands the created merchant id to the form', async () => {
    resolveMock.mockResolvedValue({
      tipo: 'Supermercado',
      plataforma_pago: 'Visa',
      source: 'model',
      merchantId: null,
      trusted: false,
    });

    const body = await (await POST(multipartRequest(withImage()))).json();

    expect(body.parsedData.merchant_id).toBe('m-1');
    expect(body.receipt.merchantId).toBe('m-1');
  });

  it('keeps the already trusted id when the upsert fails', async () => {
    resolveMock.mockResolvedValue({
      tipo: 'Supermercado',
      plataforma_pago: 'Visa',
      source: 'memory',
      merchantId: 'm-9',
      trusted: true,
    });
    recordSeenMock.mockRejectedValue(new Error('db down'));

    const body = await (await POST(multipartRequest(withImage()))).json();

    expect(body.parsedData.merchant_id).toBe('m-9');
  });

  // `finance_entries.plataforma_pago` is NOT NULL and the form's zod schema
  // requires `min(1)`, so an unreadable platform still has to prefill
  // *something*. This is a form placeholder, not a claim about the ticket —
  // which is why the honest value is reported separately in `receipt`.
  it('prefills a placeholder platform when the ticket and memory are both silent', async () => {
    resolveMock.mockResolvedValue({
      tipo: 'Supermercado',
      plataforma_pago: '',
      source: 'model',
      merchantId: null,
      trusted: false,
    });

    const body = await (await POST(multipartRequest(withImage()))).json();

    expect(body.parsedData.plataforma_pago).toBe('Efectivo');
    expect(body.receipt.plataforma_pago).toBe('');
  });

  it('omits merchant_id when there is no merchant at all', async () => {
    recordSeenMock.mockRejectedValue(new Error('db down'));
    const body = await (await POST(multipartRequest(withImage()))).json();
    expect(body.parsedData.merchant_id).toBeUndefined();
  });

  it('still returns the parse when the merchant write fails', async () => {
    recordSeenMock.mockRejectedValue(new Error('db down'));
    const res = await POST(multipartRequest(withImage()));
    expect(res.status).toBe(200);
  });

  it('reports 503 when every vision model fails', async () => {
    raceMock.mockResolvedValue({
      success: false,
      error: 'all failed',
      attempts: ['mimo-v2.5-free: timeout'],
    } as never);
    const res = await POST(multipartRequest(withImage()));
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.success).toBe(false);
  });
});
