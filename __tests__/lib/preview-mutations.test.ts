/** @jest-environment node */

import { Redis } from '@upstash/redis';

import {
  checkPreviewMutation,
  mutationResponse,
  visitorIdentity,
} from '@/lib/demo/mutations';

jest.mock('@upstash/redis', () => ({ Redis: jest.fn() }));
jest.mock('next/headers', () => ({ headers: jest.fn() }));

const evalMock = jest.fn();
const envKeys = [
  'VERCEL_ENV',
  'VERCEL',
  'UPSTASH_REDIS_URL',
  'UPSTASH_REDIS_TOKEN',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
] as const;
const original = envKeys.map((key) => process.env[key]);
const source = (ip = '203.0.113.1') =>
  new Headers({ 'x-vercel-forwarded-for': ip });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.VERCEL_ENV = 'preview';
  process.env.VERCEL = '1';
  process.env.UPSTASH_REDIS_URL = 'https://redis.example.test';
  process.env.UPSTASH_REDIS_TOKEN = 'test-token';
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  (Redis as unknown as jest.Mock).mockImplementation(() => ({
    eval: evalMock,
  }));
  evalMock.mockResolvedValue(0);
});

afterAll(() =>
  envKeys.forEach((key, i) => {
    if (original[i] === undefined) delete process.env[key];
    else Object.assign(process.env, { [key]: original[i] });
  }),
);

it.each([undefined, 'production', 'development'])(
  'leaves %s unchanged, including large batches and missing identity',
  async (environment) => {
    if (environment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = environment;
    expect(await checkPreviewMutation(new Headers(), 10000)).toBeNull();
    expect(Redis).not.toHaveBeenCalled();
  },
);

it.each([
  '',
  'unknown',
  '203.0.113.1, 203.0.113.2',
  '203.0.113.1:443',
  '[::1]',
  'fe80::1%eth0',
])('rejects malformed or missing trusted identity: %s', async (ip) => {
  const rejection = await checkPreviewMutation(source(ip));
  expect(rejection).toMatchObject({
    status: 503,
    code: 'PREVIEW_IDENTITY_REQUIRED',
    retryAfter: 60,
  });
  expect(evalMock).not.toHaveBeenCalled();
});

it('does not trust spoofed forwarding headers or a non-Vercel host', async () => {
  const spoof = new Headers({
    'x-forwarded-for': '203.0.113.1',
    'x-real-ip': '203.0.113.1',
  });
  expect(await checkPreviewMutation(spoof)).toMatchObject({
    code: 'PREVIEW_IDENTITY_REQUIRED',
  });
  const trusted = source();
  trusted.set('x-forwarded-for', '198.51.100.20');
  expect(visitorIdentity(trusted)).toBe(visitorIdentity(source()));
  delete process.env.VERCEL;
  expect(await checkPreviewMutation(trusted)).toMatchObject({
    code: 'PREVIEW_IDENTITY_REQUIRED',
  });
});

it('canonicalizes IPv6 and IPv4-mapped IPv6 without storing raw IPs', () => {
  expect(visitorIdentity(source('2001:0db8:0:0:0:0:0:1'))).toBe(
    visitorIdentity(source('2001:db8::1')),
  );
  expect(visitorIdentity(source('::ffff:203.0.113.1'))).toBe(
    visitorIdentity(source()),
  );
  expect(visitorIdentity(source())).toMatch(/^[a-f0-9]{64}$/);
});

it('shares keys across endpoints/API keys and isolates visitor and window keys', async () => {
  const first = source();
  first.set('x-api-key', 'key-one');
  first.set('host', 'preview-one.vercel.app');
  await checkPreviewMutation(first, 12);
  const second = source();
  second.set('x-api-key', 'key-two');
  second.set('host', 'preview-two.vercel.app');
  await checkPreviewMutation(second, 2);
  await checkPreviewMutation(source('203.0.113.2'));
  const keys = evalMock.mock.calls[0][1] as string[];
  expect(new Set(keys).size).toBe(4);
  expect(evalMock.mock.calls[1][1]).toEqual(keys);
  expect(evalMock.mock.calls[2][1].slice(2)).toEqual(keys.slice(2));
  expect(evalMock.mock.calls[2][1].slice(0, 2)).not.toEqual(keys.slice(0, 2));
  expect(evalMock.mock.calls[0][2]).toEqual([
    12, 60, 60000, 1000, 86400000, 300, 60000, 5000, 86400000,
  ]);
});

it('returns an HTTP 429 with a rounded-up Retry-After and Spanish guidance', async () => {
  evalMock.mockResolvedValue(1250);
  const rejection = await checkPreviewMutation(source());
  expect(rejection).toMatchObject({
    code: 'PREVIEW_RATE_LIMIT',
    retryAfter: 2,
  });
  if (!rejection) throw new Error('Expected a rejection');
  const response = mutationResponse(rejection);
  expect(response.status).toBe(429);
  expect(response.headers.get('Retry-After')).toBe('2');
  expect((await response.json()).error).toContain('Reintenta en 2 segundos');
});

it.each(['missing', 'failure', 'invalid'])(
  'fails closed on Redis %s without in-memory enforcement',
  async (mode) => {
    if (mode === 'missing') delete process.env.UPSTASH_REDIS_TOKEN;
    if (mode === 'failure') evalMock.mockRejectedValue(new Error('Redis down'));
    if (mode === 'invalid') evalMock.mockResolvedValue('0');
    for (let i = 0; i < 2; i++) {
      expect(await checkPreviewMutation(source())).toMatchObject({
        status: 503,
        code: 'PREVIEW_UNAVAILABLE',
        retryAfter: 60,
      });
    }
  },
);

it.each([0, -1, 61, 1.5, NaN])(
  'rejects invalid/oversized work %s before Redis',
  async (weight) => {
    expect(await checkPreviewMutation(source(), weight)).toMatchObject({
      code: 'PREVIEW_BATCH_LIMIT',
      status: 400,
    });
    expect(evalMock).not.toHaveBeenCalled();
  },
);
