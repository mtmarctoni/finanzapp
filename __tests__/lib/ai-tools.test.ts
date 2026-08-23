import { createClient } from '@vercel/postgres';

import { getTotalByPeriodTool } from '@/lib/ai/tools';

jest.mock('ai', () => ({
  tool: <T>(config: T) => config,
}));

jest.mock('@vercel/postgres', () => {
  const sql = jest.fn();
  return {
    createClient: () => ({
      sql,
      connect: jest.fn().mockResolvedValue(undefined),
      end: jest.fn().mockResolvedValue(undefined),
    }),
  };
});

const getMockedSql = (): jest.Mock =>
  (
    createClient() as unknown as {
      sql: jest.Mock;
    }
  ).sql;

describe('getTotalByPeriodTool', () => {
  it('returns zero totals instead of an error when a category has no rows in range', async () => {
    const mockedSql = getMockedSql();
    mockedSql.mockResolvedValue({
      rows: [{ accion: 'Gasto', total: '50.5', count: '2' }],
    });

    const tool = getTotalByPeriodTool('user-1') as unknown as {
      execute: (input: { from: string; to: string }) => Promise<{
        income: number;
        expense: number;
        investment: number;
        netBalance: number;
        error?: string;
      }>;
    };
    const result = await tool.execute({
      from: '2026-01-01T00:00:00Z',
      to: '2026-01-31T00:00:00Z',
    });

    expect(result.error).toBeUndefined();
    expect(result.income).toBe(0);
    expect(result.expense).toBe(50.5);
    expect(result.investment).toBe(0);
    expect(result.netBalance).toBe(-50.5);
  });
});
