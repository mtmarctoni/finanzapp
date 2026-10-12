/** @jest-environment node */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { Redis } from '@upstash/redis';

import { checkPreviewMutation, RESERVE_SCRIPT } from '@/lib/demo/mutations';

jest.mock('@upstash/redis', () => ({ Redis: jest.fn() }));
jest.mock('next/headers', () => ({ headers: jest.fn() }));

// Opt-in because CI only requires Node. Runs the exact shipped Lua against a
// fresh real Redis, not a JavaScript imitation of its reservation algorithm.
const integration =
  process.env.RUN_PREVIEW_REDIS_INTEGRATION === '1' ? describe : describe.skip;
const run = promisify(execFile);

integration('Preview atomic weighted Redis enforcement', () => {
  let socket: string;
  const envKeys = [
    'VERCEL_ENV',
    'VERCEL',
    'UPSTASH_REDIS_URL',
    'UPSTASH_REDIS_TOKEN',
  ] as const;
  const original = envKeys.map((key) => process.env[key]);

  async function command(...args: string[]) {
    const { stdout } = await run('redis-cli', ['-s', socket, '--raw', ...args]);
    return stdout.trim();
  }

  beforeAll(async () => {
    const configured = process.env.PREVIEW_REDIS_TEST_SOCKET;
    if (!configured)
      throw new Error(
        'Start an isolated disposable Redis and set PREVIEW_REDIS_TEST_SOCKET (the test flushes it)',
      );
    socket = configured;
    expect(await command('PING')).toBe('PONG');
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL = '1';
    process.env.UPSTASH_REDIS_URL = 'https://redis.example.test';
    process.env.UPSTASH_REDIS_TOKEN = 'test-token';
    (Redis as unknown as jest.Mock).mockImplementation(() => ({
      eval: async (script: string, keys: string[], args: number[]) =>
        Number(
          await command(
            'EVAL',
            script,
            String(keys.length),
            ...keys,
            ...args.map(String),
          ),
        ),
    }));
  });

  afterAll(() => {
    envKeys.forEach((key, i) => {
      if (original[i] === undefined) delete process.env[key];
      else Object.assign(process.env, { [key]: original[i] });
    });
  });

  beforeEach(async () => {
    await command('FLUSHDB');
  });

  const visitor = (number = 1, apiKey = 'one') =>
    new Headers({
      'x-vercel-forwarded-for': `203.0.113.${number}`,
      'x-api-key': apiKey,
    });
  const prefix = 'finanzapp:preview:mutations:v1';

  it('admits exactly 60 concurrent units, across independently created Redis clients', async () => {
    const results = await Promise.all(
      Array.from({ length: 70 }, async (_, i) =>
        checkPreviewMutation(visitor(1, String(i))),
      ),
    );
    expect(results.filter((result) => result === null)).toHaveLength(60);
    expect(results.filter((result) => result?.status === 429)).toHaveLength(10);
    expect(await command('GET', `${prefix}:aggregate:minute`)).toBe('60');
    expect(await command('GET', `${prefix}:aggregate:day`)).toBe('60');
  });

  it('charges batches by weight and does not partially consume budgets on rejection', async () => {
    expect(await checkPreviewMutation(visitor(), 59)).toBeNull();
    expect(await checkPreviewMutation(visitor(1, 'rotated'), 2)).toMatchObject({
      status: 429,
    });
    expect(await command('GET', `${prefix}:aggregate:minute`)).toBe('59');
    expect(await checkPreviewMutation(visitor(), 1)).toBeNull();
  });

  it('isolates visitors sharing an account and enforces the aggregate minute cap', async () => {
    for (let i = 1; i <= 5; i++)
      expect(await checkPreviewMutation(visitor(i), 60)).toBeNull();
    expect(await checkPreviewMutation(visitor(6), 1)).toMatchObject({
      status: 429,
    });
    expect(await command('GET', `${prefix}:aggregate:day`)).toBe('300');
  });

  it('keeps the visitor daily ceiling when minute keys expire', async () => {
    for (let i = 0; i < 16; i++) {
      expect(await checkPreviewMutation(visitor(), 60)).toBeNull();
      const keys = (await command('KEYS', `${prefix}:*:minute`)).split('\n');
      await command('DEL', ...keys);
    }
    expect(await checkPreviewMutation(visitor(), 40)).toBeNull();
    expect(await checkPreviewMutation(visitor(), 1)).toMatchObject({
      status: 429,
    });
    expect(await checkPreviewMutation(visitor(2), 1)).toBeNull();
    expect(await command('GET', `${prefix}:aggregate:day`)).toBe('1001');
  });

  it('enforces the aggregate daily ceiling independently of visitor and minute caps', async () => {
    await command('SET', `${prefix}:aggregate:day`, '4999', 'PX', '86400000');
    expect(await checkPreviewMutation(visitor(), 1)).toBeNull();
    expect(await checkPreviewMutation(visitor(2), 1)).toMatchObject({
      status: 429,
    });
    expect(await command('GET', `${prefix}:aggregate:minute`)).toBe('1');
  });

  it('starts independent windows, expires them, and returns the longest blocked retry', async () => {
    const keys = [
      'visitor:minute',
      'visitor:day',
      'aggregate:minute',
      'aggregate:day',
    ];
    const reserve = async () =>
      Number(
        await command(
          'EVAL',
          RESERVE_SCRIPT,
          '4',
          ...keys,
          '1',
          '1',
          '30',
          '1',
          '100',
          '1',
          '30',
          '1',
          '100',
        ),
      );
    expect(await reserve()).toBe(0);
    expect(await reserve()).toBeGreaterThan(30);
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(await reserve()).toBe(0);
  });
});
