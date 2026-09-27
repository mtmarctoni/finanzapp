import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { type Session } from 'next-auth';

import { mergeCategoryOptions } from '@/lib/categories';
import {
  ensureCategory,
  getCategories,
  getFormOptions,
} from '@/lib/server-data';

const mockQuery = jest.fn();

jest.mock('@/lib/db', () => ({
  getPool: jest.fn(() => ({ query: mockQuery })),
}));

const SQL_FILES = [
  'db/migrations/20260926_create_categories.sql',
  'db/init.sql',
];

const session = { user: { id: 'user-1' } } as unknown as Session;

describe('getCategories', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('reads from the categories table and returns names in row order', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ name: 'Alquiler' }, { name: 'Ocio' }, { name: 'QFI' }],
    });

    await expect(getCategories(session)).resolves.toEqual([
      'Alquiler',
      'Ocio',
      'QFI',
    ]);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('FROM categories c');
    expect(sql).toContain('c.active = true');
    // Must consider both tables, otherwise a category used only by a recurring
    // record would be missing from the /records dropdown (the original bug).
    expect(sql).toContain('finance_entries');
    expect(sql).toContain('recurring_records');
    expect(params).toEqual(['user-1']);
  });

  it('scopes the usage joins to the requesting user', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await getCategories(session);

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/fe\.user_id = c\.user_id/);
    expect(sql).toMatch(/rr\.user_id = c\.user_id/);
  });

  /**
   * Regression guard, verified against PostgreSQL 16. A mocked pool cannot catch
   * this: it returns whatever rows it is told to regardless of the SQL.
   *
   * The two joins are independent one-to-many matches on the same key, so they
   * fan out against each other. A category with 3 entries and 2 recurring records
   * produces 3x2=6 rows, and plain COUNT(fe.id)/COUNT(rr.id) then each report 6
   * (12 total) instead of 3 and 2 (5 total). The inflation is proportional to
   * usage in *both* tables, so it silently reorders the dropdown, lifting
   * lightly-used dual-table categories above heavily-used single-table ones.
   */
  it('counts usage with DISTINCT so the two joins cannot fan out', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await getCategories(session);

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain('COUNT(DISTINCT fe.id) + COUNT(DISTINCT rr.id)');
    // Guard against a regression back to the fanning-out form.
    expect(sql).not.toMatch(/COUNT\(fe\.id\)\s*\+\s*COUNT\(rr\.id\)/);
  });

  it('rejects an unauthenticated caller', async () => {
    await expect(getCategories(null)).rejects.toThrow('Not authenticated');
    await expect(
      getCategories({ user: {} } as unknown as Session),
    ).rejects.toThrow('Not authenticated');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('surfaces a database failure', async () => {
    mockQuery.mockRejectedValue(new Error('connection refused'));

    await expect(getCategories(session)).rejects.toThrow(
      'Failed to fetch categories.',
    );
  });

  /**
   * getFormOptions shares one pool and one try/catch across every dropdown
   * source, so a throw here takes down que, plataforma_pago and quien too.
   * Deploying the app before the migration is applied is exactly that case.
   */
  it('degrades to an empty list when the categories table is missing', async () => {
    const missingTable = Object.assign(new Error('relation does not exist'), {
      code: '42P01',
    });
    mockQuery.mockRejectedValue(missingTable);

    await expect(getCategories(session)).resolves.toEqual([]);
  });

  it('still throws for failures that are not a missing table', async () => {
    // A permission or connection problem must not hide behind an empty
    // dropdown, or a real outage looks like "no categories configured".
    for (const code of ['42501', 'ECONNREFUSED', '08006']) {
      mockQuery.mockRejectedValue(Object.assign(new Error('boom'), { code }));

      await expect(getCategories(session)).rejects.toThrow(
        'Failed to fetch categories.',
      );
    }
  });

  it('degrades on the driver message when no SQLSTATE code is present', async () => {
    // The app reaches Postgres through @neondatabase/serverless, not `pg`.
    // Verified in that driver's parseErrorMessage that `code` is assigned from
    // the SQLSTATE field, so 42P01 does arrive as error.code -- but the message
    // is checked too so a driver that omits the code still degrades.
    mockQuery.mockRejectedValue(
      new Error('relation "categories" does not exist'),
    );

    await expect(getCategories(session)).resolves.toEqual([]);
  });

  it('does not degrade on an unrelated error that merely mentions categories', async () => {
    mockQuery.mockRejectedValue(
      new Error('permission denied for table categories'),
    );

    await expect(getCategories(session)).rejects.toThrow(
      'Failed to fetch categories.',
    );
  });
});

describe('ensureCategory', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('returns the existing name when one already matches', async () => {
    mockQuery.mockResolvedValue({ rows: [{ name: 'Alquiler' }] });

    await expect(ensureCategory('user-1', 'Alquiler')).resolves.toBe(
      'Alquiler',
    );

    // Only the lookup should run; no insert needed.
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toContain('LOWER(name) = LOWER($2)');
  });

  it('matches existing names case-insensitively to avoid duplicate rows', async () => {
    mockQuery.mockResolvedValue({ rows: [{ name: 'Alquiler' }] });

    await expect(ensureCategory('user-1', 'ALQUILER')).resolves.toBe(
      'Alquiler',
    );
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('inserts when no match exists and returns the stored name', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ name: 'Cripto W' }] });

    await expect(ensureCategory('user-1', 'Cripto W')).resolves.toBe(
      'Cripto W',
    );

    expect(mockQuery).toHaveBeenCalledTimes(2);
    const [insertSql, insertParams] = mockQuery.mock.calls[1];
    expect(insertSql).toContain('INSERT INTO categories');
    expect(insertSql).toContain('ON CONFLICT (user_id, name)');
    expect(insertParams).toEqual(['user-1', 'Cripto W']);
  });

  it('trims surrounding whitespace before storing', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ name: 'Ocio' }] });

    await ensureCategory('user-1', '  Ocio  ');

    expect(mockQuery.mock.calls[1][1]).toEqual(['user-1', 'Ocio']);
  });

  it('rejects an empty or whitespace-only name without querying', async () => {
    await expect(ensureCategory('user-1', '   ')).rejects.toThrow(
      'Category name cannot be empty',
    );
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('surfaces a database failure', async () => {
    mockQuery.mockRejectedValue(new Error('connection refused'));

    await expect(ensureCategory('user-1', 'Ocio')).rejects.toThrow(
      'Failed to save category.',
    );
  });
});

describe('categories backfill SQL', () => {
  const read = (file: string) =>
    readFileSync(join(process.cwd(), file), 'utf8');

  it.each(SQL_FILES)(
    '%s trims tipo on the way into the categories table',
    (file) => {
      const sql = read(file);

      // The Combobox create path persists the raw input, so untrimmed tipo values
      // can exist. ensureCategory() trims but matches case-insensitively, not
      // whitespace-insensitively, so an untrimmed backfill row would sit beside
      // the tidy version as a second dropdown entry.
      expect(sql).toMatch(/TRIM\(tipo\)\s*<>\s*''/);
      expect(sql).toMatch(/SELECT DISTINCT user_id, TRIM\(tipo\)/);
      // Both source tables, or recurring-only categories stay missing.
      expect(sql).toMatch(/TRIM\(tipo\)[\s\S]*FROM finance_entries/);
      expect(sql).toMatch(/TRIM\(tipo\)[\s\S]*FROM recurring_records/);
    },
  );

  it.each(SQL_FILES)('%s skips rows with no owner', (file) => {
    const sql = read(file);
    expect(sql).toMatch(/user_id IS NOT NULL/);
  });

  it.each(SQL_FILES)('%s is safe to re-run', (file) => {
    const sql = read(file);
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS categories');
    expect(sql).toContain('ON CONFLICT (user_id, name) DO NOTHING');
  });

  it('keeps the migration and init.sql backfills in agreement', () => {
    const migration = read('db/migrations/20260926_create_categories.sql');
    const init = read('db/init.sql');

    // The two files are applied to different environments, so a silent drift
    // between them means dev and CI disagree about the seeded category list.
    const normalise = (sql: string) =>
      sql
        .replace(/--[^\n]*/g, '')
        .replace(/TRIM\(tipo\)/g, 'TRIM')
        .replace(/\s+/g, ' ')
        .trim();

    expect(normalise(init)).toContain(normalise(migration));
  });
});

describe('getFormOptions', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  // Answer each query by the column it selects, so a field wired to the wrong
  // query surfaces as a mismatch instead of quietly returning another
  // column's values.
  function respondByColumn() {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM categories c')) {
        return { rows: [{ name: 'Alquiler' }] };
      }
      if (sql.includes('que AS value')) {
        return { rows: [{ value: 'Cena' }] };
      }
      if (sql.includes('plataforma_pago AS value')) {
        return { rows: [{ value: 'Tarjeta' }] };
      }
      if (sql.includes('quien AS value')) {
        return { rows: [{ value: 'Yo' }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
  }

  // Regression guard. An earlier draft had five queries in the Promise.all
  // against four destructured slots: a duplicated `que` query shifted
  // everything along, so plataforma_pago returned que values and quien
  // returned plataforma_pago values.
  it('maps each field to its own query', async () => {
    respondByColumn();

    await expect(getFormOptions(session)).resolves.toEqual({
      tipo: mergeCategoryOptions(['Alquiler']),
      que: ['Cena'],
      plataforma_pago: ['Tarjeta'],
      quien: ['Yo'],
    });
  });

  it('runs exactly one query per field', async () => {
    respondByColumn();

    await getFormOptions(session);

    // getCategories (1) + que + plataforma_pago + quien
    expect(mockQuery).toHaveBeenCalledTimes(4);
  });

  it('sources tipo from the categories table, not DISTINCT over finance_entries', async () => {
    respondByColumn();

    const { tipo } = await getFormOptions(session);

    expect(tipo).toEqual(mergeCategoryOptions(['Alquiler']));
    const tipoQueries = mockQuery.mock.calls
      .map(([sql]: [string]) => sql)
      .filter((sql) => sql.includes('tipo AS value'));
    expect(tipoQueries).toEqual([]);
  });

  it('still returns the other fields when the categories table is missing', async () => {
    // The options endpoint shares one try/catch across every dropdown source,
    // so if this threw, que, plataforma_pago and quien would blank out too.
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM categories c')) {
        throw Object.assign(new Error('relation "categories" does not exist'), {
          code: '42P01',
        });
      }
      if (sql.includes('que AS value')) {
        return { rows: [{ value: 'Cena' }] };
      }
      if (sql.includes('plataforma_pago AS value')) {
        return { rows: [{ value: 'Tarjeta' }] };
      }
      if (sql.includes('quien AS value')) {
        return { rows: [{ value: 'Yo' }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(getFormOptions(session)).resolves.toEqual({
      tipo: mergeCategoryOptions([]),
      que: ['Cena'],
      plataforma_pago: ['Tarjeta'],
      quien: ['Yo'],
    });
  });
});
