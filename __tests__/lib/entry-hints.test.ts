import { type Session } from 'next-auth';

import { getEntryHints } from '@/lib/server-data';

const mockQuery = jest.fn();

jest.mock('@/lib/db', () => ({
  getPool: jest.fn(() => ({ query: mockQuery })),
}));

const session = { user: { id: 'user-1' } } as unknown as Session;

describe('getEntryHints', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('maps categories to their usual action and qué to its last filing', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('MODE() WITHIN GROUP (ORDER BY accion)')) {
        return {
          rows: [
            { tipo: 'Salario', accion: 'Ingreso' },
            { tipo: 'Comida', accion: 'Gasto' },
          ],
        };
      }
      if (sql.includes('DISTINCT ON (LOWER(que))')) {
        return {
          rows: [
            { que: 'mercadona', tipo: 'Supermercado', plataforma_pago: 'BBVA' },
          ],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(getEntryHints(session)).resolves.toEqual({
      tipoAccion: { Salario: 'Ingreso', Comida: 'Gasto' },
      byQue: {
        mercadona: { tipo: 'Supermercado', plataforma_pago: 'BBVA' },
      },
    });
  });

  it('scopes both queries to the signed-in user', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await getEntryHints(session);

    expect(mockQuery).toHaveBeenCalledTimes(2);
    for (const [, params] of mockQuery.mock.calls) {
      expect(params).toEqual(['user-1']);
    }
  });

  it('takes the most recent filing of each qué', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await getEntryHints(session);

    const queSql = (mockQuery.mock.calls as [string][])
      .map(([sql]) => sql)
      .find((sql) => sql.includes('DISTINCT ON'));
    expect(queSql).toMatch(/ORDER BY LOWER\(que\), fecha DESC/);
  });
});
