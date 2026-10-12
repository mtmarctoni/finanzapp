/** @jest-environment node */

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import { createEntry } from '@/lib/actions';
import { RESERVE_SCRIPT } from '@/lib/demo/mutations';
import { insertEntry } from '@/lib/entries/repo';
import { applyMerchantConfirmation } from '@/lib/merchants/repo';
import { ensureCategory } from '@/lib/server-data';
import { requireSessionUserId } from '@/lib/session';

// Exercise the installed SDK's constructor, auto-pipeline and HTTP retry loop.
// Only its HTTP transport is mocked; no Redis class/eval substitute is used.
jest.unmock('@upstash/redis');
jest.mock('next/headers', () => ({ headers: jest.fn() }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/session', () => ({ requireSessionUserId: jest.fn() }));
jest.mock('@/lib/entries/repo', () => ({
  insertEntry: jest.fn(),
  isUniqueViolation: jest.fn(),
}));
jest.mock('@/lib/server-data', () => ({ ensureCategory: jest.fn() }));
jest.mock('@/lib/merchants/repo', () => ({
  applyMerchantConfirmation: jest.fn(),
}));
jest.mock('@/lib/users/repo', () => ({
  insertUser: jest.fn(),
  findUserByEmail: jest.fn(),
}));

const envKeys = [
  'VERCEL_ENV',
  'VERCEL',
  'UPSTASH_REDIS_URL',
  'UPSTASH_REDIS_TOKEN',
] as const;
const original = envKeys.map((key) => process.env[key]);
const entry = {
  fecha: '2026-10-01',
  accion: 'Gasto',
  tipo: 'Comida',
  que: 'Pan',
  plataforma_pago: 'Cash',
  cantidad: 5,
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.VERCEL_ENV = 'preview';
  process.env.VERCEL = '1';
  process.env.UPSTASH_REDIS_URL = 'https://redis.example.test';
  process.env.UPSTASH_REDIS_TOKEN = 'test-token';
  (headers as jest.Mock).mockResolvedValue(
    new Headers({ 'x-vercel-forwarded-for': '203.0.113.1' }),
  );
  (requireSessionUserId as jest.Mock).mockResolvedValue('session-user');
});

afterEach(() => jest.restoreAllMocks());
afterAll(() =>
  envKeys.forEach((key, i) => {
    if (original[i] === undefined) delete process.env[key];
    else Object.assign(process.env, { [key]: original[i] });
  }),
);

function noDomainWrites() {
  for (const write of [
    insertEntry,
    ensureCategory,
    applyMerchantConfirmation,
    revalidatePath,
  ]) {
    expect(write).not.toHaveBeenCalled();
  }
}

it('does not replay an executed weighted EVAL when its HTTP response is lost', async () => {
  let executedUnits = 0;
  const commands: unknown[][] = [];
  const transport = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as unknown[];
      // SDK auto-pipelining wraps the command; support direct EVAL as well.
      const command = (Array.isArray(body[0]) ? body[0] : body) as unknown[];
      commands.push(command);
      expect(command[0]).toBe('eval');
      expect(command[1]).toBe(RESERVE_SCRIPT);
      executedUnits += Number(command[7]);
      // Server executed the reservation, but the client never got its response.
      throw new TypeError('Response lost after Redis execution');
    });

  const result = await createEntry(entry);
  expect(result).toMatchObject({
    ok: false,
    status: 503,
    code: 'PREVIEW_UNAVAILABLE',
    retryAfter: 60,
  });
  expect(transport).toHaveBeenCalledTimes(1);
  expect(commands).toHaveLength(1);
  expect(executedUnits).toBe(2);
  noDomainWrites();
});

it('maps the real three-second abort timeout through the SDK to a safe 503', async () => {
  let requestSignal: AbortSignal | undefined;
  const transport = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (_url, init) => {
      const signal = init?.signal;
      if (!signal) throw new Error('Expected the configured timeout signal');
      requestSignal = signal;
      await new Promise<never>((_resolve, reject) => {
        if (signal.aborted) reject(signal.reason);
        else
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          });
      });
      throw new Error('Unreachable: transport must abort');
    });

  const result = await createEntry(entry);
  expect(requestSignal?.aborted).toBe(true);
  expect(requestSignal?.reason).toMatchObject({ name: 'TimeoutError' });
  expect(result).toMatchObject({
    ok: false,
    status: 503,
    code: 'PREVIEW_UNAVAILABLE',
    retryAfter: 60,
  });
  expect(transport).toHaveBeenCalledTimes(1);
  noDomainWrites();
}, 8000);
