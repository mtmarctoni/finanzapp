/** @jest-environment node */

import { Redis } from '@upstash/redis';
import { createClient } from '@vercel/postgres';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { DELETE as revokeKey } from '@/app/api/api-keys/[id]/route';
import { POST as createKey } from '@/app/api/api-keys/route';
import { POST as duplicateTransaction } from '@/app/api/crypto/transactions/[id]/duplicate/route';
import {
  PUT as updateTransaction,
  DELETE as deleteTransaction,
} from '@/app/api/crypto/transactions/[id]/route';
import { POST as createTransaction } from '@/app/api/crypto/transactions/route';
import { POST as createWallet } from '@/app/api/crypto/wallets/route';
import { POST as duplicateEntry } from '@/app/api/entries/[id]/duplicate/route';
import { DELETE as deleteMerchant } from '@/app/api/merchants/route';
import {
  POST as createRecurring,
  PUT as updateRecurring,
  DELETE as deleteRecurring,
} from '@/app/api/recurring/route';
import { DELETE as deleteSafeboxMovement } from '@/app/api/safebox/movements/[id]/route';
import { POST as createSafeboxMovement } from '@/app/api/safebox/movements/route';
import { POST as createApiEntries } from '@/app/api/v1/entries/route';
import { authenticateAndRateLimitApiRequest } from '@/lib/api-auth';
import * as apiKeys from '@/lib/api-keys';
import * as crypto from '@/lib/cryptoActions';
import { deleteMerchantById } from '@/lib/merchants/repo';
import * as recurring from '@/lib/recurring/repo';
import * as safebox from '@/lib/safeboxActions';
import { ensureCategory } from '@/lib/server-data';

jest.mock('next-auth');
jest.mock('@upstash/redis', () => ({ Redis: jest.fn() }));
jest.mock('@vercel/postgres', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/api-auth', () => ({
  authenticateAndRateLimitApiRequest: jest.fn(),
}));
jest.mock('@/lib/cryptoActions', () => ({
  createCryptoTransaction: jest.fn(),
  updateCryptoTransaction: jest.fn(),
  deleteCryptoTransaction: jest.fn(),
  duplicateCryptoTransaction: jest.fn(),
  createCryptoWallet: jest.fn(),
}));
jest.mock('@/lib/recurring/repo', () => ({
  createRecurringRecord: jest.fn(),
  updateRecurringRecord: jest.fn(),
  deleteRecurringRecord: jest.fn(),
}));
jest.mock('@/lib/api-keys', () => ({
  createApiKey: jest.fn(),
  revokeApiKey: jest.fn(),
  markApiKeyUsed: jest.fn(),
}));
jest.mock('@/lib/merchants/repo', () => ({ deleteMerchantById: jest.fn() }));
jest.mock('@/lib/server-data', () => ({ ensureCategory: jest.fn() }));
jest.mock('@/lib/safeboxActions', () => ({
  createSafeboxMovement: jest.fn(),
  deleteSafeboxMovement: jest.fn(),
}));

const evalMock = jest.fn();
const envKeys = [
  'VERCEL_ENV',
  'VERCEL',
  'UPSTASH_REDIS_URL',
  'UPSTASH_REDIS_TOKEN',
] as const;
const original = envKeys.map((key) => process.env[key]);
const record = {
  id: 'r1',
  name: 'Alquiler',
  amount: 5,
  accion: 'Gasto',
  tipo: 'Casa',
  frequency: 'monthly',
  plataforma_pago: 'Cash',
};
const entry = {
  fecha: '2026-10-01T12:00:00Z',
  accion: 'Gasto',
  tipo: 'Casa',
  que: 'Alquiler',
  cantidad: 5,
  plataforma_pago: 'Cash',
  quien: 'Yo',
};
const context = { params: Promise.resolve({ id: 'owned-id' }) };
const movement = {
  movementType: 'deposit',
  amount: 50,
  note: 'del cajero',
  movementDate: '2026-10-11T10:00:00.000Z',
};
const request = (body: unknown = {}, method = 'POST') =>
  new NextRequest('https://preview.vercel.app/api/mutation?id=owned-id', {
    method,
    headers: {
      'content-type': 'application/json',
      'x-vercel-forwarded-for': '203.0.113.1',
    },
    body: JSON.stringify(body),
  });
const boundaries = [
  ['finance duplicate', async () => duplicateEntry(request(), context)],
  ['crypto create', async () => createTransaction(request())],
  ['crypto update', async () => updateTransaction(request({}, 'PUT'), context)],
  [
    'crypto delete',
    async () => deleteTransaction(request({}, 'DELETE'), context),
  ],
  ['crypto duplicate', async () => duplicateTransaction(request(), context)],
  ['wallet create', async () => createWallet(request())],
  ['safebox create', async () => createSafeboxMovement(request(movement))],
  [
    'safebox delete',
    async () => deleteSafeboxMovement(request({}, 'DELETE'), context),
  ],
  ['merchant delete', async () => deleteMerchant(request({}, 'DELETE'))],
  ['API-key create', async () => createKey(request({ name: 'test-key' }))],
  ['API-key revoke', async () => revokeKey(request({}, 'DELETE'), context)],
  ['recurring create', async () => createRecurring(request(record))],
  ['recurring update', async () => updateRecurring(request(record, 'PUT'))],
  [
    'recurring delete',
    async () => deleteRecurring(request({ id: 'r1' }, 'DELETE')),
  ],
  [
    'API-key batch entries',
    async () => createApiEntries(request({ entries: [entry, entry, entry] })),
  ],
] as const;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.VERCEL_ENV = 'preview';
  process.env.VERCEL = '1';
  process.env.UPSTASH_REDIS_URL = 'https://redis.example.test';
  process.env.UPSTASH_REDIS_TOKEN = 'test-token';
  (Redis as unknown as jest.Mock).mockImplementation(() => ({
    eval: evalMock,
  }));
  evalMock.mockResolvedValue(60000);
  (getServerSession as jest.Mock).mockResolvedValue({
    user: { id: 'session-user' },
  });
  (authenticateAndRateLimitApiRequest as jest.Mock).mockResolvedValue({
    auth: { userId: 'session-user', keyId: 'key-one' },
  });
});
afterAll(() =>
  envKeys.forEach((key, i) => {
    if (original[i] === undefined) delete process.env[key];
    else Object.assign(process.env, { [key]: original[i] });
  }),
);

function noWrites() {
  for (const write of [
    createClient,
    crypto.createCryptoTransaction,
    crypto.updateCryptoTransaction,
    crypto.deleteCryptoTransaction,
    crypto.duplicateCryptoTransaction,
    crypto.createCryptoWallet,
    recurring.createRecurringRecord,
    recurring.updateRecurringRecord,
    recurring.deleteRecurringRecord,
    apiKeys.createApiKey,
    apiKeys.revokeApiKey,
    apiKeys.markApiKeyUsed,
    deleteMerchantById,
    ensureCategory,
    safebox.createSafeboxMovement,
    safebox.deleteSafeboxMovement,
  ])
    expect(write).not.toHaveBeenCalled();
}

it.each(boundaries)(
  '%s rejects a controlled burst before DB writes',
  async (_name, call) => {
    const response = await call();
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(await response.json()).toMatchObject({
      code: 'PREVIEW_RATE_LIMIT',
      ok: false,
    });
    expect(evalMock).toHaveBeenCalledTimes(1);
    noWrites();
  },
);

it.each(boundaries)(
  '%s authenticates before the Preview guard',
  async (_name, call) => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    (authenticateAndRateLimitApiRequest as jest.Mock).mockResolvedValue({
      auth: null,
    });
    expect((await call()).status).toBe(401);
    expect(evalMock).not.toHaveBeenCalled();
    noWrites();
  },
);

it.each(boundaries)('%s fails closed on Redis outage', async (_name, call) => {
  evalMock.mockRejectedValue(new Error('distributed store unavailable'));
  expect((await call()).status).toBe(503);
  noWrites();
});

it('charges API-key batches by entries plus metadata and cannot evade the shared namespace by rotating keys', async () => {
  await createApiEntries(request({ entries: [entry, entry, entry] }));
  expect(evalMock.mock.calls[0][2][0]).toBe(4);
  (authenticateAndRateLimitApiRequest as jest.Mock).mockResolvedValue({
    auth: { userId: 'session-user', keyId: 'rotated' },
  });
  await createApiEntries(request(entry));
  await createWallet(request());
  expect(evalMock.mock.calls[1][1]).toEqual(evalMock.mock.calls[0][1]);
  expect(evalMock.mock.calls[2][1]).toEqual(evalMock.mock.calls[0][1]);
  noWrites();
});

it('rejects oversized public API work before opening the mutation connection', async () => {
  expect(
    (
      await createApiEntries(
        request({ entries: Array.from({ length: 60 }, () => entry) }),
      )
    ).status,
  ).toBe(400);
  expect(evalMock).not.toHaveBeenCalled();
  noWrites();
});

it('recurring routes reserve once then call the owned internal repository', async () => {
  evalMock.mockResolvedValue(0);
  (recurring.createRecurringRecord as jest.Mock).mockResolvedValue(record);
  expect((await createRecurring(request(record))).status).toBe(200);
  expect(evalMock).toHaveBeenCalledTimes(1);
  expect(recurring.createRecurringRecord).toHaveBeenCalledWith(
    expect.objectContaining({ user_id: 'session-user' }),
  );
  expect(evalMock.mock.calls[0][2][0]).toBe(2);
});

const safeboxBoundaries = [
  ['create', async () => createSafeboxMovement(request(movement)), 201],
  [
    'delete',
    async () => deleteSafeboxMovement(request({}, 'DELETE'), context),
    200,
  ],
] as const;

function allowSafeboxWrites() {
  (safebox.createSafeboxMovement as jest.Mock).mockResolvedValue({
    ok: true,
    movement: { id: 'owned-id', ...movement },
  });
  (safebox.deleteSafeboxMovement as jest.Mock).mockResolvedValue('deleted');
}

it.each(safeboxBoundaries)(
  'safebox %s reserves one unit once before its owned facade write',
  async (name, call, status) => {
    evalMock.mockResolvedValue(0);
    allowSafeboxWrites();
    const response = await call();
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(
      name === 'create' ? { id: 'owned-id', ...movement } : { deleted: true },
    );
    expect(evalMock).toHaveBeenCalledTimes(1);
    expect(evalMock.mock.calls[0][2][0]).toBe(1);
    const write =
      name === 'create'
        ? safebox.createSafeboxMovement
        : safebox.deleteSafeboxMovement;
    const otherWrite =
      name === 'create'
        ? safebox.deleteSafeboxMovement
        : safebox.createSafeboxMovement;
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(
      name === 'create' ? movement : 'owned-id',
      { user: { id: 'session-user' } },
    );
    expect(otherWrite).not.toHaveBeenCalled();
    expect(evalMock.mock.invocationCallOrder[0]).toBeLessThan(
      (write as jest.Mock).mock.invocationCallOrder[0],
    );
  },
);

it('safebox rejects invalid input before reserving or writing', async () => {
  expect(
    (await createSafeboxMovement(request({ ...movement, amount: -5 }))).status,
  ).toBe(400);
  expect(evalMock).not.toHaveBeenCalled();
  noWrites();
});

it('safebox shares identical visitor and aggregate buckets with other mutation routes', async () => {
  await createSafeboxMovement(request(movement));
  await deleteSafeboxMovement(request({}, 'DELETE'), context);
  await createWallet(request());
  expect(evalMock).toHaveBeenCalledTimes(3);
  expect(evalMock.mock.calls[0][1]).toEqual(evalMock.mock.calls[2][1]);
  expect(evalMock.mock.calls[1][1]).toEqual(evalMock.mock.calls[2][1]);
  noWrites();
});

it.each(['production', undefined])(
  'safebox preserves successful writes without Redis in %s',
  async (environment) => {
    if (environment === undefined) {
      delete process.env.VERCEL_ENV;
      delete process.env.VERCEL;
    } else process.env.VERCEL_ENV = environment;
    allowSafeboxWrites();
    for (const [, call, status] of safeboxBoundaries) {
      expect((await call()).status).toBe(status);
    }
    expect(evalMock).not.toHaveBeenCalled();
    expect(safebox.createSafeboxMovement).toHaveBeenCalledTimes(1);
    expect(safebox.deleteSafeboxMovement).toHaveBeenCalledTimes(1);
  },
);
