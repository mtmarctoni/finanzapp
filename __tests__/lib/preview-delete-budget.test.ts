/** @jest-environment node */

import { withClient } from '@/lib/db';
import { deleteWithPreviewBudget } from '@/lib/demo/delete-budget';

jest.mock('@/lib/db', () => ({ withClient: jest.fn() }));
const query = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  (withClient as jest.Mock).mockImplementation(async (fn) => fn({ query }));
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('FOR UPDATE')) return { rows: [{ id: 'owned-parent' }] };
    if (sql.includes('LIMIT 61'))
      return { rows: [{ id: 'child-1' }, { id: 'child-2' }] };
    return { rows: [] };
  });
});

it.each(['entry', 'merchant'] as const)(
  'reserves only cascading rows for %s after locking owned parents, before DELETE',
  async (kind) => {
    const authorize = jest.fn(async () => {
      expect(query.mock.calls.some(([sql]) => sql.startsWith('DELETE'))).toBe(
        false,
      );
    });
    await deleteWithPreviewBudget(
      kind,
      ['parent', 'parent'],
      'session-user',
      authorize,
    );
    expect(authorize).toHaveBeenCalledTimes(1);
    expect(authorize).toHaveBeenCalledWith(2);
    expect(query.mock.calls[0][0]).toBe('BEGIN');
    expect(query.mock.calls[1][0]).toContain('ORDER BY id FOR UPDATE');
    expect(query.mock.calls[1][1]).toEqual(['session-user', ['parent']]);
    expect(query.mock.calls[2][1]).toEqual([['owned-parent']]);
    expect(query.mock.calls[3][0]).toContain('DELETE FROM');
    expect(query.mock.calls[3][1]).toEqual(['session-user', ['owned-parent']]);
    expect(query.mock.calls[4][0]).toBe('COMMIT');
  },
);

it('rolls back without deleting when the additional reservation rejects', async () => {
  await expect(
    deleteWithPreviewBudget(
      'merchant',
      ['parent'],
      'session-user',
      async () => {
        throw new Error('Rejected');
      },
    ),
  ).rejects.toThrow('Rejected');
  expect(query.mock.calls.some(([sql]) => sql.startsWith('DELETE'))).toBe(
    false,
  );
  expect(query.mock.calls[query.mock.calls.length - 1][0]).toBe('ROLLBACK');
});

it('bounds total submitted and cascading rows together, even though base units were reserved earlier', async () => {
  const authorize = jest.fn(async () => {
    throw new Error('Oversized');
  });
  await expect(
    deleteWithPreviewBudget(
      'entry',
      Array.from({ length: 59 }, (_, i) => String(i)),
      'session-user',
      authorize,
    ),
  ).rejects.toThrow('Oversized');
  expect(authorize).toHaveBeenCalledWith(61);
  expect(query.mock.calls.some(([sql]) => sql.startsWith('DELETE'))).toBe(
    false,
  );
});

it('requires the internal authorizer; it is never a client bypass flag', async () => {
  await expect(
    deleteWithPreviewBudget('entry', ['parent'], 'session-user'),
  ).rejects.toThrow('requires a cascade authorizer');
  expect(withClient).not.toHaveBeenCalled();
});
