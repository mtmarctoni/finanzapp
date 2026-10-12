/** @jest-environment node */

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import {
  createEntry,
  updateEntry,
  deleteEntry,
  deleteManyEntries,
  createUser,
} from '@/lib/actions';
import { reservePreviewBudget } from '@/lib/demo/budget';
import * as entries from '@/lib/entries/repo';
import { applyMerchantConfirmation } from '@/lib/merchants/repo';
import * as recurringRepo from '@/lib/recurring/repo';
import * as recurring from '@/lib/recurringActions';
import { ensureCategory } from '@/lib/server-data';
import { requireSessionUserId } from '@/lib/session';
import { insertUser } from '@/lib/users/repo';

jest.mock('@/lib/demo/budget', () => ({ reservePreviewBudget: jest.fn() }));
jest.mock('next/headers', () => ({ headers: jest.fn() }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/session', () => ({ requireSessionUserId: jest.fn() }));
jest.mock('@/lib/entries/repo', () => ({
  insertEntry: jest.fn(),
  updateEntryById: jest.fn(),
  deleteEntryById: jest.fn(),
  deleteEntriesByIds: jest.fn(),
  isUniqueViolation: jest.fn(),
}));
jest.mock('@/lib/recurring/repo', () => ({
  createRecurringRecord: jest.fn(),
  updateRecurringRecord: jest.fn(),
  deleteRecurringRecord: jest.fn(),
  generateFinanceEntries: jest.fn(),
  getRecurringRecords: jest.fn(),
}));
jest.mock('@/lib/server-data', () => ({ ensureCategory: jest.fn() }));
jest.mock('@/lib/merchants/repo', () => ({
  applyMerchantConfirmation: jest.fn(),
}));
jest.mock('@/lib/users/repo', () => ({
  insertUser: jest.fn(),
  findUserByEmail: jest.fn(),
}));

const evalMock = reservePreviewBudget as jest.Mock;
const keys = [
  'VERCEL_ENV',
  'VERCEL',
  'UPSTASH_REDIS_URL',
  'UPSTASH_REDIS_TOKEN',
] as const;
const original = keys.map((key) => process.env[key]);
const entry = {
  fecha: '2026-10-01',
  accion: 'Gasto',
  tipo: 'Comida',
  que: 'Pan',
  plataforma_pago: 'Cash',
  cantidad: 5,
};
const record = {
  id: 'r1',
  name: 'Pan',
  accion: 'Gasto',
  tipo: 'Comida',
  detalle1: '',
  detalle2: '',
  quien: 'Yo',
  amount: 5,
  frequency: 'monthly',
  active: true,
  dia: 1,
  plataforma_pago: 'Cash',
  user_id: 'attacker-selected-user',
};
const form = (name: string, value: string) => {
  const data = new FormData();
  data.set(name, value);
  return data;
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.VERCEL_ENV = 'preview';
  process.env.VERCEL = '1';
  process.env.UPSTASH_REDIS_URL = 'https://redis.example.test';
  process.env.UPSTASH_REDIS_TOKEN = 'test-token';
  evalMock.mockResolvedValue(60000);
  (headers as jest.Mock).mockResolvedValue(
    new Headers({ 'x-vercel-forwarded-for': '203.0.113.1' }),
  );
  (requireSessionUserId as jest.Mock).mockResolvedValue('session-user');
});
afterAll(() =>
  keys.forEach((key, i) => {
    if (original[i] === undefined) delete process.env[key];
    else Object.assign(process.env, { [key]: original[i] });
  }),
);

it('rejects every finance boundary with serializable guidance before any side effects', async () => {
  for (const call of [
    async () =>
      createEntry(
        { ...entry, origen: 'receipt' },
        { comercio: 'Shop', categoriaPrefill: 'Comida' },
      ),
    async () => updateEntry('e1', entry),
    async () => deleteEntry(form('entryId', 'e1')),
    async () => deleteManyEntries(form('ids', 'e1,e2')),
    async () => createUser({ name: 'Name', email: 'user@example.test' }),
  ]) {
    const result = await call();
    expect(JSON.parse(JSON.stringify(result))).toMatchObject({
      ok: false,
      status: 429,
      retryAfter: 60,
    });
  }
  for (const write of [
    entries.insertEntry,
    entries.updateEntryById,
    entries.deleteEntryById,
    entries.deleteEntriesByIds,
    ensureCategory,
    applyMerchantConfirmation,
    insertUser,
    revalidatePath,
  ])
    expect(write).not.toHaveBeenCalled();
});

it('charges unique bulk rows, rejects oversized batches and preserves local behavior', async () => {
  evalMock.mockResolvedValue(0);
  await deleteManyEntries(form('ids', 'e1,e2,e1'));
  expect(evalMock.mock.calls[0][1]).toBe(2);
  jest.clearAllMocks();
  const ids = Array.from({ length: 61 }, (_, i) => `e${i}`).join(',');
  expect(await deleteManyEntries(form('ids', ids))).toMatchObject({
    code: 'PREVIEW_BATCH_LIMIT',
  });
  expect(entries.deleteEntriesByIds).not.toHaveBeenCalled();
  delete process.env.VERCEL_ENV;
  await deleteManyEntries(form('ids', ids));
  expect(entries.deleteEntriesByIds).toHaveBeenCalledWith(
    ids.split(','),
    'session-user',
  );
});

it('authenticates before reservation', async () => {
  (requireSessionUserId as jest.Mock).mockRejectedValue(
    new Error('Unauthorized'),
  );
  await expect(createEntry(entry)).rejects.toThrow('Unauthorized');
  expect(evalMock).not.toHaveBeenCalled();
  expect(entries.insertEntry).not.toHaveBeenCalled();
});

it('returns database outages safely and does not write', async () => {
  evalMock.mockRejectedValue(new Error('internal database error'));
  expect(await createEntry(entry)).toMatchObject({
    status: 503,
    code: 'PREVIEW_UNAVAILABLE',
  });
  expect(entries.insertEntry).not.toHaveBeenCalled();
});

it('returns a structured cascade denial after reserving only the base delete once', async () => {
  evalMock.mockResolvedValueOnce(0).mockResolvedValueOnce(60000);
  (entries.deleteEntryById as jest.Mock).mockImplementationOnce(
    async (_id, _userId, authorize) => {
      await authorize(2);
    },
  );
  expect(await deleteEntry(form('entryId', 'e1'))).toMatchObject({
    ok: false,
    status: 429,
  });
  expect(evalMock.mock.calls.map((call) => call[1])).toEqual([1, 2]);
  expect(revalidatePath).not.toHaveBeenCalled();
});

it('guards recurring direct RPCs, overriding caller ownership and filtering update fields', async () => {
  await recurring.getRecurringRecords('attacker');
  expect(recurringRepo.getRecurringRecords).toHaveBeenCalledWith(
    'session-user',
  );
  expect(await recurring.createRecurringRecord(record)).toMatchObject({
    ok: false,
  });
  expect(
    await recurring.updateRecurringRecord('r1', record, 'attacker'),
  ).toMatchObject({ ok: false });
  expect(await recurring.deleteRecurringRecord('r1', 'attacker')).toMatchObject(
    { ok: false },
  );
  expect(recurringRepo.createRecurringRecord).not.toHaveBeenCalled();
  expect(recurringRepo.updateRecurringRecord).not.toHaveBeenCalled();
  expect(recurringRepo.deleteRecurringRecord).not.toHaveBeenCalled();
  evalMock.mockResolvedValue(0);
  await recurring.createRecurringRecord(record);
  expect(recurringRepo.createRecurringRecord).toHaveBeenCalledWith({
    ...record,
    user_id: 'session-user',
  });
  await recurring.updateRecurringRecord('r1', record, 'attacker');
  const data = (recurringRepo.updateRecurringRecord as jest.Mock).mock
    .calls[0][1];
  expect(data).not.toHaveProperty('user_id');
  expect(data).not.toHaveProperty('id');
  expect(recurringRepo.updateRecurringRecord).toHaveBeenCalledWith(
    'r1',
    data,
    'session-user',
  );
});

it('translates generation rejection to an action result, with session-scoped repository calls', async () => {
  (recurringRepo.generateFinanceEntries as jest.Mock).mockImplementation(
    async (_id, _date, _year, _month, authorize) => {
      await authorize(5);
      return { generated: 5 };
    },
  );
  expect(
    await recurring.generateFinanceEntries('attacker', '2026-10-01', 2026, 10),
  ).toMatchObject({ ok: false, status: 429 });
  expect(recurringRepo.generateFinanceEntries).toHaveBeenCalledWith(
    'session-user',
    '2026-10-01',
    2026,
    10,
    expect.any(Function),
  );
  expect(evalMock.mock.calls[0][1]).toBe(5);
});
