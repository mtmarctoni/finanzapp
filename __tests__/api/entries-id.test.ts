/** @jest-environment node */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { GET } from '@/app/api/entries/[id]/route';
import { getPool } from '@/lib/db';

// Automock rather than a factory: the real auth route imports next-auth's
// default export, and a partial factory would leave it undefined.
jest.mock('next-auth');
jest.mock('@/lib/db', () => ({ getPool: jest.fn() }));

const sessionMock = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const getPoolMock = getPool as jest.MockedFunction<typeof getPool>;
const queryMock = jest.fn();

async function call(id: string) {
  return GET(new NextRequest(`http://localhost:3000/api/entries/${id}`), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  getPoolMock.mockReturnValue({ query: queryMock } as never);
  sessionMock.mockResolvedValue({ user: { id: 'user-1' } } as never);
});

describe('GET /api/entries/[id]', () => {
  it('returns 401 without a session and never queries', async () => {
    sessionMock.mockResolvedValue(null);

    const response = await call('e-1');

    expect(response.status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  // This route once interpolated the id into the SQL and did not scope by
  // owner, so it served every user's entries.
  it('scopes the parameterized query to the session user', async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 'e-1', user_id: 'user-1' }] });

    const response = await call("e-1' OR '1'='1");

    expect(response.status).toBe(200);
    const [sql, values] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/WHERE id = \$1 AND user_id = \$2/);
    expect(sql).not.toContain('e-1');
    expect(values).toEqual(["e-1' OR '1'='1", 'user-1']);
  });

  it("returns 404 for another user's entry", async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const response = await call('someone-elses-entry');

    expect(response.status).toBe(404);
  });
});
