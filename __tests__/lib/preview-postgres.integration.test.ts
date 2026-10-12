/** @jest-environment node */

import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const integration = process.env.PREVIEW_POSTGRES_TEST_URL
  ? describe
  : describe.skip;
const run = promisify(execFile);

// The exact migration runs in a uniquely named schema. Only that schema is
// cleared/dropped; existing application tables and counters are never touched.
integration('PostgreSQL atomic demo budgets', () => {
  const schema = `preview_budget_test_${randomUUID().replaceAll('-', '')}`;
  const visitor = (n = 1) =>
    createHash('sha256').update(String(n)).digest('hex');

  async function sql(statement: string) {
    const connection = process.env.PREVIEW_POSTGRES_TEST_URL;
    if (!connection) throw new Error('Missing PostgreSQL test connection');
    const url = new URL(connection);
    const { stdout } = await run(
      process.env.PSQL_BIN ?? 'psql',
      ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', statement],
      {
        env: {
          ...process.env,
          PGHOST: url.hostname,
          PGPORT: url.port || '5432',
          PGUSER: decodeURIComponent(url.username),
          PGPASSWORD: decodeURIComponent(url.password),
          PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
          PGSSLMODE: url.searchParams.get('sslmode') ?? 'require',
          PGOPTIONS: `-c search_path=${schema},public`,
        },
        timeout: 30000,
      },
    );
    return stdout.trim();
  }

  const reserve = async (n = 1, units = 1) =>
    Number(
      await sql(`SELECT reserve_preview_mutation('${visitor(n)}', ${units})`),
    );
  const count = async (bucket: string) =>
    Number(
      await sql(
        `SELECT units FROM preview_mutation_budgets WHERE bucket = '${bucket}'`,
      ),
    );

  beforeAll(async () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        'db/migrations/20261012_create_preview_mutation_budgets.sql',
      ),
      'utf8',
    ).replace(
      'SET search_path = public, pg_temp',
      `SET search_path = ${schema}, pg_temp`,
    );
    await sql(`CREATE SCHEMA ${schema}; ${migration}`);
  }, 30000);
  afterAll(async () => {
    await sql(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  }, 30000);
  beforeEach(async () => {
    await sql('DELETE FROM preview_mutation_budgets');
  }, 30000);

  it('admits exactly 60 of 70 concurrent reservations with independent connections', async () => {
    const results = await Promise.all(
      Array.from({ length: 70 }, async () => reserve()),
    );
    expect(results.filter((result) => result === 0)).toHaveLength(60);
    expect(results.filter((result) => result > 0)).toHaveLength(10);
    expect(await count('aggregate:minute')).toBe(60);
    expect(await count('aggregate:day')).toBe(60);
  }, 120000);

  it('charges weighted batches and consumes none of the other budgets on denial', async () => {
    expect(await reserve(1, 59)).toBe(0);
    expect(await reserve(1, 2)).toBeGreaterThan(0);
    expect(await count('aggregate:minute')).toBe(59);
    expect(await count('aggregate:day')).toBe(59);
    expect(await reserve()).toBe(0);
  }, 30000);

  it('isolates visitors and enforces the aggregate minute ceiling', async () => {
    for (let i = 1; i <= 5; i++) expect(await reserve(i, 60)).toBe(0);
    expect(await reserve(6)).toBeGreaterThan(0);
    expect(await count('aggregate:day')).toBe(300);
    expect(
      await sql(
        `SELECT count(*) FROM preview_mutation_budgets WHERE bucket LIKE 'visitor:${visitor(6)}:%'`,
      ),
    ).toBe('0');
  }, 30000);

  it('enforces the visitor daily ceiling independently of expired minute windows', async () => {
    expect(await reserve()).toBe(0);
    await sql(`UPDATE preview_mutation_budgets SET units = 1000 WHERE bucket = 'visitor:${visitor()}:day';
      UPDATE preview_mutation_budgets SET expires_at = NOW() - INTERVAL '1 second' WHERE bucket LIKE '%:minute'`);
    expect(await reserve()).toBeGreaterThan(60000);
    expect(await reserve(2)).toBe(0);
    expect(await count('aggregate:day')).toBe(2);
  }, 30000);

  it('enforces the aggregate daily ceiling without partially charging a new visitor', async () => {
    expect(await reserve()).toBe(0);
    await sql(
      "UPDATE preview_mutation_budgets SET units = 4999 WHERE bucket = 'aggregate:day'",
    );
    expect(await reserve()).toBe(0);
    expect(await reserve(2)).toBeGreaterThan(60000);
    expect(await count('aggregate:minute')).toBe(2);
  }, 30000);

  it('does not extend accepted windows and resets expired windows after inactivity', async () => {
    expect(await reserve()).toBe(0);
    const expiries = await sql(
      'SELECT bucket, expires_at FROM preview_mutation_budgets ORDER BY bucket',
    );
    expect(await reserve()).toBe(0);
    expect(
      await sql(
        'SELECT bucket, expires_at FROM preview_mutation_budgets ORDER BY bucket',
      ),
    ).toBe(expiries);
    await sql(
      "UPDATE preview_mutation_budgets SET expires_at = NOW() - INTERVAL '1 day'",
    );
    expect(await reserve(1, 60)).toBe(0);
    expect(await count(`visitor:${visitor()}:day`)).toBe(60);
    expect(await count('aggregate:day')).toBe(60);
  }, 30000);

  it('returns the longest blocked window and rejects invalid work without writes', async () => {
    expect(await reserve(1, 60)).toBe(0);
    await sql(`UPDATE preview_mutation_budgets SET units = 1000, expires_at = NOW() + INTERVAL '1 hour'
      WHERE bucket = 'visitor:${visitor()}:day'`);
    expect(await reserve()).toBeGreaterThan(3500000);
    await expect(reserve(2, 61)).rejects.toThrow();
    expect(await count('aggregate:day')).toBe(60);
  }, 30000);
});
