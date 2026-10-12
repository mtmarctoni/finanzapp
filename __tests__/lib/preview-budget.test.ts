/** @jest-environment node */

import { withPool } from '@/lib/db';
import { reservePreviewBudget } from '@/lib/demo/budget';

jest.mock('@/lib/db', () => ({ withPool: jest.fn() }));

const query = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (withPool as jest.Mock).mockImplementation((fn) => fn({ query }));
});

it('uses one parameterized atomic statement', async () => {
  query.mockResolvedValue({ rows: [{ retry_ms: 1250 }] });
  expect(await reservePreviewBudget('hashed-visitor', 2)).toBe(1250);
  expect(query).toHaveBeenCalledWith({
    text: 'SELECT reserve_preview_mutation($1, $2) AS retry_ms',
    values: ['hashed-visitor', 2],
  });
});

it('does not replay a reservation whose database response was lost', async () => {
  query.mockRejectedValue(new Error('Connection lost after commit'));
  await expect(reservePreviewBudget('hashed-visitor', 2)).rejects.toThrow(
    'Connection lost after commit',
  );
  expect(query).toHaveBeenCalledTimes(1);
});
