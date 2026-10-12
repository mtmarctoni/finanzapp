/** @jest-environment node */

import * as postgres from '@vercel/postgres';
import * as ai from 'ai';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import type * as ConsentRoute from '../../app/api/ai/confirm-paid/route';

import * as fallback from '@/lib/ai/fallback';
import * as rateLimit from '@/lib/ai/rate-limit';
import * as tools from '@/lib/ai/tools';
import { isPreviewDemo } from '@/lib/demo/policy';
import * as merchants from '@/lib/merchants/repo';
import * as dedupe from '@/lib/receipts/dedupe';
import * as image from '@/lib/receipts/image';
import * as resolve from '@/lib/receipts/resolve';

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('../../app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));
jest.mock('@vercel/postgres', () => ({ createClient: jest.fn() }));
jest.mock('ai', () => ({
  generateObject: jest.fn(),
  streamText: jest.fn(),
  stepCountIs: jest.fn(),
  convertToModelMessages: jest.fn(),
}));
jest.mock('@/lib/ai/fallback', () => ({
  raceFreeProviders: jest.fn(),
  executePaidFallback: jest.fn(),
  getTotalSpent: jest.fn(() => 0),
  getCostBreakdown: jest.fn(() => ({ free: 0, paid: 0 })),
  getRecentCosts: jest.fn(() => []),
  isPaidFallbackAvailable: jest.fn(() => true),
  PAID_FALLBACK: { name: 'Paid model' },
}));
jest.mock('@/lib/ai/rate-limit', () => ({
  checkRateLimit: jest.fn(),
  getRateLimitHeaders: jest.fn(() => ({})),
  createRateLimitResponse: jest.fn(),
}));
jest.mock('@/lib/ai/tools', () => ({
  createFinanceEntryTool: jest.fn(),
  getRecentEntriesTool: jest.fn(),
  getSpendingByCategoryTool: jest.fn(),
  getTotalByPeriodTool: jest.fn(),
}));
jest.mock('@/lib/merchants/repo', () => ({ recordMerchantSeen: jest.fn() }));
jest.mock('@/lib/receipts/dedupe', () => ({
  findEntryByContentHash: jest.fn(),
  findSimilarReceiptEntry: jest.fn(),
}));
jest.mock('@/lib/receipts/image', () => ({
  validateImageUpload: jest.fn(),
  toDataUrl: jest.fn(),
  ReceiptImageError: class extends Error {},
}));
jest.mock('@/lib/receipts/resolve', () => ({
  resolveMerchantClassification: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const sessionMock = jest.mocked(getServerSession);
const userId = 'preview-policy-user';
const expectedError = {
  error:
    'La IA está deshabilitada en esta demo. Puedes añadir la entrada o los datos del recibo manualmente.',
  message:
    'La IA está deshabilitada en esta demo. Puedes añadir la entrada o los datos del recibo manualmente.',
  code: 'PREVIEW_AI_DISABLED',
};
const originalEnv = { ...process.env };
let consent: typeof ConsentRoute;
type Handler = (request: NextRequest) => Promise<Response>;
const routes: {
  name: string;
  method: string;
  handler: Handler;
  allowedStatus: number;
}[] = [];

beforeAll(async () => {
  // The existing consent store schedules cleanup at module load. Freeze it so
  // tests can prove request-driven store access independently of that timer.
  jest.useFakeTimers();
  consent = await import('../../app/api/ai/confirm-paid/route');
  const chat = await import('../../app/api/ai/chat/route');
  const entry = await import('../../app/api/ai/parse-entry/route');
  const form = await import('../../app/api/ai/parse-for-form/route');
  const receipt = await import('../../app/api/ai/parse-receipt/route');
  const costs = await import('../../app/api/ai/costs/route');
  routes.push(
    { name: 'chat', method: 'POST', handler: chat.POST, allowedStatus: 400 },
    {
      name: 'parse-entry',
      method: 'POST',
      handler: entry.POST,
      allowedStatus: 400,
    },
    {
      name: 'parse-for-form',
      method: 'POST',
      handler: form.POST,
      allowedStatus: 400,
    },
    {
      name: 'parse-receipt',
      method: 'POST',
      handler: receipt.POST,
      allowedStatus: 415,
    },
    {
      name: 'confirm-paid',
      method: 'GET',
      handler: consent.GET,
      allowedStatus: 200,
    },
    {
      name: 'confirm-paid',
      method: 'POST',
      handler: consent.POST,
      allowedStatus: 400,
    },
    { name: 'costs', method: 'GET', handler: costs.GET, allowedStatus: 200 },
  );
});

beforeEach(() => {
  jest.clearAllMocks();
  sessionMock.mockResolvedValue({ user: { id: userId } });
  jest
    .mocked(rateLimit.checkRateLimit)
    .mockResolvedValue({ allowed: true } as never);
  process.env.GROQ_API_KEY = 'configured';
  process.env.OPENROUTER_API_KEY = 'configured';
  process.env.OPENCODE_API_KEY = 'configured';
});

afterEach(() => {
  jest.restoreAllMocks();
  process.env = { ...originalEnv };
});

afterAll(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

function requestFor(name: string, method: string, body = '{}') {
  return new NextRequest(`http://localhost/api/ai/${name}`, {
    method,
    ...(method === 'POST' ? { body } : {}),
    headers: { 'Content-Type': 'application/json', 'X-Confirm-Paid': 'true' },
  });
}

function expectNoFeatureWork() {
  for (const feature of [
    postgres,
    ai,
    fallback,
    rateLimit,
    tools,
    merchants,
    dedupe,
    image,
    resolve,
  ]) {
    for (const value of Object.values(feature)) {
      if (jest.isMockFunction(value)) expect(value).not.toHaveBeenCalled();
    }
  }
}

describe('Preview AI route methods', () => {
  it.each(['preview', 'production', 'development', undefined])(
    'preserves 401 before any feature work in %s',
    async (env) => {
      if (env === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = env;
      sessionMock.mockResolvedValue(null);
      for (const route of routes) {
        const request = requestFor(route.name, route.method, '{malformed');
        const json = jest.spyOn(request, 'json');
        const formData = jest.spyOn(request, 'formData');
        expect((await route.handler(request)).status).toBe(401);
        expect(json).not.toHaveBeenCalled();
        expect(formData).not.toHaveBeenCalled();
      }
      expectNoFeatureWork();
    },
  );

  it.each(['{"confirmed":true,"confirmPaidFallback":true}', '{malformed'])(
    'rejects every method before parsing, providers or consent even with keys and body %s',
    async (body) => {
      process.env.VERCEL_ENV = 'production';
      // Seed actual paid consent, then ensure Preview neither reads nor mutates it.
      await consent.POST(
        requestFor('confirm-paid', 'POST', '{"confirmed":true}'),
      );
      process.env.VERCEL_ENV = 'preview';
      const get = jest.spyOn(Map.prototype, 'get');
      const set = jest.spyOn(Map.prototype, 'set');
      const remove = jest.spyOn(Map.prototype, 'delete');
      for (const route of routes) {
        const request = requestFor(route.name, route.method, body);
        const json = jest.spyOn(request, 'json');
        const formData = jest.spyOn(request, 'formData');
        const response = await route.handler(request);
        expect(response.status).toBe(403);
        expect(response.headers.get('content-type')).toContain(
          'application/json',
        );
        expect(await response.json()).toEqual(expectedError);
        expect(json).not.toHaveBeenCalled();
        expect(formData).not.toHaveBeenCalled();
      }
      for (const spy of [get, set, remove]) {
        expect(spy.mock.calls.filter(([key]) => key === userId)).toEqual([]);
      }
      expectNoFeatureWork();
    },
  );

  it('rejects a duplicate receipt before upload parsing or the database lookup', async () => {
    process.env.VERCEL_ENV = 'preview';
    jest
      .mocked(dedupe.findEntryByContentHash)
      .mockResolvedValue({ id: 'existing' } as never);
    const form = new FormData();
    form.set(
      'image',
      new File([new Uint8Array([0xff, 0xd8, 0xff])], 'receipt.jpg', {
        type: 'image/jpeg',
      }),
    );
    const request = new NextRequest('http://localhost/api/ai/parse-receipt', {
      method: 'POST',
      body: form,
    });
    const parse = jest.spyOn(request, 'formData');
    const route = routes.find((route) => route.name === 'parse-receipt');
    if (!route) throw new Error('Receipt route was not loaded');
    expect((await route.handler(request)).status).toBe(403);
    expect(parse).not.toHaveBeenCalled();
    expectNoFeatureWork();
  });

  it.each(['production', 'development', undefined])(
    'retains existing validation, consent and costs behavior in %s',
    async (env) => {
      if (env === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = env;
      expect(isPreviewDemo()).toBe(false);
      for (const route of routes) {
        expect(
          (await route.handler(requestFor(route.name, route.method))).status,
        ).toBe(route.allowedStatus);
      }
      expect(rateLimit.checkRateLimit).toHaveBeenCalledTimes(4);
      expect(fallback.getTotalSpent).toHaveBeenCalledTimes(1);
      const saved = await consent.POST(
        requestFor('confirm-paid', 'POST', '{"confirmed":true}'),
      );
      expect(saved.status).toBe(200);
      expect(
        await (await consent.GET(requestFor('confirm-paid', 'GET'))).json(),
      ).toMatchObject({ confirmed: true });
    },
  );
});
