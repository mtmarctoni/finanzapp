/** @jest-environment node */

import { cookies } from 'next/headers';
import { getToken } from 'next-auth/jwt';

import { requireSessionUserId } from '@/lib/session';

jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }));

const cookiesMock = cookies as unknown as jest.Mock;
const getTokenMock = getToken as unknown as jest.Mock;
const COOKIE_STORE = { getAll: () => [] };

beforeEach(() => {
  jest.clearAllMocks();
  cookiesMock.mockResolvedValue(COOKIE_STORE);
});

describe('requireSessionUserId', () => {
  it('returns the user id stored in the session token', async () => {
    getTokenMock.mockResolvedValue({ id: 'user-1' });
    await expect(requireSessionUserId()).resolves.toBe('user-1');
    expect(getTokenMock).toHaveBeenCalledWith({
      req: { cookies: COOKIE_STORE, headers: {} },
    });
  });

  it('throws when there is no session token', async () => {
    getTokenMock.mockResolvedValue(null);
    await expect(requireSessionUserId()).rejects.toThrow('Not authenticated');
  });

  it('throws when the token carries no user id', async () => {
    getTokenMock.mockResolvedValue({ sub: 'x' });
    await expect(requireSessionUserId()).rejects.toThrow('Not authenticated');
  });
});
