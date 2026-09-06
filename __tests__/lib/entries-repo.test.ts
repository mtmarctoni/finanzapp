import { findEntries } from '@/lib/entries/repo';

const mockWithPool = jest.fn();
jest.mock('@/lib/db', () => ({
  withPool: (callback: unknown) => mockWithPool(callback),
  withClient: jest.fn(),
}));

describe('findEntries / compileFilter', () => {
  let query: jest.Mock;
  let countSql: string;
  let countParams: (string | number)[];
  let tableSql: string;
  let tableParams: (string | number)[];

  beforeEach(() => {
    jest.clearAllMocks();
    query = jest.fn().mockResolvedValue({ rows: [{ count: 0 }] });
    mockWithPool.mockImplementation(
      async (callback: (client: { query: typeof query }) => unknown) => {
        return callback({ query });
      },
    );
  });

  function capture() {
    countSql = query.mock.calls[0][0] as string;
    countParams = query.mock.calls[0][1] as (string | number)[];
    tableSql = query.mock.calls[1][0] as string;
    tableParams = query.mock.calls[1][1] as (string | number)[];
  }

  it('builds que, min and max amount clauses in parameter order', async () => {
    await findEntries(
      {
        page: 1,
        itemsPerPage: 10,
        search: 'agua',
        accion: 'Gasto',
        tipo: 'Vivienda',
        que: 'Alquiler',
        minAmount: 50,
        maxAmount: 500,
      },
      'user-1',
    );
    capture();

    expect(countSql).toContain('accion ILIKE $1');
    expect(countSql).toContain('accion = $2');
    expect(countSql).toContain('tipo = $3');
    expect(countSql).toContain('que = $4');
    expect(countSql).toContain('cantidad >= $5');
    expect(countSql).toContain('cantidad <= $6');
    expect(countSql).toContain('user_id = $7');
    expect(countParams).toEqual([
      '%agua%',
      'Gasto',
      'Vivienda',
      'Alquiler',
      50,
      500,
      'user-1',
    ]);
  });

  it('ignores the que filter when it equals todos', async () => {
    await findEntries(
      {
        page: 1,
        itemsPerPage: 10,
        tipo: 'Vivienda',
        que: 'todos',
      },
      'user-1',
    );
    capture();

    expect(countSql).not.toContain('que =');
    expect(countSql).toContain('tipo = $1');
    expect(countSql).toContain('user_id = $2');
    expect(countParams).toEqual(['Vivienda', 'user-1']);
  });

  it('omits min/max clauses when the amounts are undefined', async () => {
    await findEntries(
      { page: 1, itemsPerPage: 10, tipo: 'Vivienda' },
      'user-1',
    );
    capture();

    expect(countSql).not.toContain('cantidad >=');
    expect(countSql).not.toContain('cantidad <=');
  });

  it('parameterizes special characters instead of concatenating them', async () => {
    await findEntries(
      {
        page: 1,
        itemsPerPage: 10,
        tipo: 'Vivienda & 50%',
        search: '100% Hipoteca',
      },
      'user-1',
    );
    capture();

    // Raw values must never appear inside the SQL string.
    expect(countSql).not.toContain('Vivienda & 50%');
    expect(countSql).not.toContain('100% Hipoteca');
    // The tipo is bound verbatim; the search term is escaped for LIKE.
    expect(countParams[1]).toBe('Vivienda & 50%');
    expect(countParams[0]).toBe('%100\\% Hipoteca%');
  });

  it('sorts via the whitelisted column and paginates with bound params', async () => {
    await findEntries(
      {
        page: 3,
        itemsPerPage: 10,
        tipo: 'Vivienda',
        sortBy: 'cantidad',
        sortOrder: 'asc',
      },
      'user-1',
    );
    capture();

    expect(tableSql).toContain('ORDER BY cantidad ASC');
    expect(tableSql).toContain('LIMIT $3');
    expect(tableSql).toContain('OFFSET $4');
    expect(tableParams).toEqual(['Vivienda', 'user-1', 10, 20]);
  });

  it('falls back to fecha DESC for unknown sort fields', async () => {
    await findEntries(
      { page: 1, itemsPerPage: 10, sortBy: 'id', sortOrder: 'desc' },
      'user-1',
    );
    capture();

    expect(tableSql).toContain('ORDER BY fecha DESC');
  });
});
