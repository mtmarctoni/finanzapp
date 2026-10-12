/** @jest-environment node */

import { createHash } from 'node:crypto';

import { createClient } from '@vercel/postgres';

import { verifyApiKey, markApiKeyUsed } from '@/lib/api-keys';

jest.mock('@vercel/postgres', () => ({ createClient: jest.fn() }));
const query = jest.fn();
const sql = jest.fn();
const end = jest.fn();
const original = process.env.VERCEL_ENV;
const key = 'fa_preview-test-key';

beforeEach(() => {
  jest.clearAllMocks();
  (createClient as jest.Mock).mockReturnValue({
    connect: jest.fn(),
    query,
    sql,
    end,
  });
  // Legacy candidate matches regardless of the deployment's pepper configuration.
  query.mockResolvedValue({
    rows: [
      {
        id: 'key-1',
        user_id: 'user-1',
        key_hash: createHash('sha256').update(key).digest('hex'),
      },
    ],
  });
});
afterAll(() => {
  if (original === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = original;
});

it('verifies read-only in Preview, so missing identity/Redis rejection cannot write last_used_at', async () => {
  process.env.VERCEL_ENV = 'preview';
  expect(await verifyApiKey(key)).toEqual({ keyId: 'key-1', userId: 'user-1' });
  expect(query).toHaveBeenCalledTimes(1);
  expect(query.mock.calls[0][0]).toContain('SELECT');
  expect(sql).not.toHaveBeenCalled();
  expect(end).toHaveBeenCalled();
  await markApiKeyUsed('key-1', 'user-1');
  expect(sql.mock.calls[0].slice(1)).toEqual(['key-1', 'user-1']);
  expect(sql.mock.calls[0][0].join(' ')).toContain('AND user_id =');
});

it('preserves the last-used write during authentication in Production', async () => {
  process.env.VERCEL_ENV = 'production';
  expect(await verifyApiKey(key)).toEqual({ keyId: 'key-1', userId: 'user-1' });
  expect(sql).toHaveBeenCalledTimes(1);
});
