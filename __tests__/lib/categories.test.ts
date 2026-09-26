import { type Session } from 'next-auth';

import {
  ensureCategory,
  getCategories,
  getFormOptions,
} from '@/lib/server-data';

const mockQuery = jest.fn();

jest.mock('@/lib/db', () => ({
  getPool: jest.fn(() => ({ query: mockQuery })),
}));

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

describe('getFormOptions', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  /**
   * Each pool.query is answered by matching the column it selects, so a field
   * wired to the wrong query shows up as a mismatch rather than silently
   * returning another column's values.
   */
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

  it('maps each field to its own query', async () => {
    respondByColumn();

    const options = await getFormOptions(session);

    expect(options).toEqual({
      tipo: ['Alquiler'],
      que: ['Cena'],
      plataforma_pago: ['Tarjeta'],
      quien: ['Yo'],
    });
  });

  it('sources tipo from the categories table, not DISTINCT over finance_entries', async () => {
    respondByColumn();

    const { tipo } = await getFormOptions(session);

    expect(tipo).toEqual(['Alquiler']);
    const categoryQueries = mockQuery.mock.calls.filter(([sql]: [string]) =>
      sql.includes('FROM categories c'),
    );
    expect(categoryQueries).toHaveLength(1);
    expect(
      mockQuery.mock.calls.some(
        ([sql]: [string]) =>
          sql.includes('tipo AS value') && sql.includes('finance_entries'),
      ),
    ).toBe(false);
  });

  it('runs exactly one query per field', async () => {
    respondByColumn();

    await getFormOptions(session);

    // getCategories (1) + que + plataforma_pago + quien
    expect(mockQuery).toHaveBeenCalledTimes(4);
  });
});
