/** @jest-environment node */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { POST } from '@/app/api/crypto/transactions/[id]/duplicate/route';
import { duplicateCryptoTransaction } from '@/lib/cryptoActions';

// Automock rather than a factory: the real auth route imports next-auth's
// default export, and a partial factory would leave it undefined.
jest.mock('next-auth');
jest.mock('@/lib/cryptoActions', () => ({
  duplicateCryptoTransaction: jest.fn(),
}));

const sessionMock = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const duplicateMock = duplicateCryptoTransaction as jest.MockedFunction<
  typeof duplicateCryptoTransaction
>;

async function call(id: string) {
  return POST(
    new NextRequest(
      `http://localhost:3000/api/crypto/transactions/${id}/duplicate`,
      { method: 'POST' },
    ),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  sessionMock.mockResolvedValue({ user: { id: 'user-1' } } as never);
});

describe('POST /api/crypto/transactions/[id]/duplicate', () => {
  it('returns 401 without a session and duplicates nothing', async () => {
    sessionMock.mockResolvedValue(null);

    const response = await call('t-1');

    expect(response.status).toBe(401);
    expect(duplicateMock).not.toHaveBeenCalled();
  });

  it('duplicates as the session user', async () => {
    duplicateMock.mockResolvedValue({ id: 't-2' } as never);

    const response = await call('t-1');

    expect(response.status).toBe(200);
    expect(duplicateMock).toHaveBeenCalledWith('t-1', {
      user: { id: 'user-1' },
    });
    await expect(response.json()).resolves.toEqual({ id: 't-2' });
  });

  it("returns 404 when the transaction is not the user's", async () => {
    duplicateMock.mockResolvedValue(null);

    const response = await call('t-1');

    expect(response.status).toBe(404);
  });
});
