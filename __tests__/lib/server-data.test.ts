import { type Session } from 'next-auth';

import { getSummaryStats } from '@/lib/server-data';

jest.mock('@/lib/db', () => ({
  getPool: jest.fn(() => ({
    query: jest.fn().mockRejectedValue(new Error('Database unavailable')),
  })),
}));

describe('getSummaryStats database-error fallback', () => {
  it('returns a complete stats shape including incomeBreakdown when queries fail', async () => {
    const session = { user: { id: 'user-1' } } as unknown as Session;

    const result = await getSummaryStats(undefined, session);

    expect(result.totalIncome).toBe(0);
    expect(result.expenseBreakdown).toEqual({
      total: 0,
      categories: [],
      averageMonthly: 0,
      hasMore: false,
    });
    expect(result.incomeBreakdown).toEqual({
      total: 0,
      categories: [],
      averageMonthly: 0,
      hasMore: false,
    });
  });
});
