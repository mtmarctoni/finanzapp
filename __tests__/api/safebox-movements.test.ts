/** @jest-environment node */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { DELETE } from '@/app/api/safebox/movements/[id]/route';
import { GET, POST } from '@/app/api/safebox/movements/route';
import {
  createSafeboxMovement,
  deleteSafeboxMovement,
  getSafeboxMovements,
} from '@/lib/safeboxActions';

// Automock rather than a factory: the real auth route imports next-auth's
// default export, and a partial factory would leave it undefined.
jest.mock('next-auth');
jest.mock('@/lib/safeboxActions', () => ({
  createSafeboxMovement: jest.fn(),
  deleteSafeboxMovement: jest.fn(),
  getSafeboxMovements: jest.fn(),
}));

const sessionMock = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const createMock = createSafeboxMovement as jest.MockedFunction<
  typeof createSafeboxMovement
>;
const deleteMock = deleteSafeboxMovement as jest.MockedFunction<
  typeof deleteSafeboxMovement
>;
const listMock = getSafeboxMovements as jest.MockedFunction<
  typeof getSafeboxMovements
>;

const VALID_BODY = {
  movementType: 'deposit',
  amount: 50,
  note: 'del cajero',
  movementDate: '2026-10-11T10:00:00.000Z',
};

async function postCall(body: unknown) {
  return POST(
    new NextRequest('http://localhost:3000/api/safebox/movements', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
}

async function deleteCall(id: string) {
  return DELETE(
    new NextRequest(`http://localhost:3000/api/safebox/movements/${id}`, {
      method: 'DELETE',
    }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  sessionMock.mockResolvedValue({ user: { id: 'user-1' } } as never);
});

describe('GET /api/safebox/movements', () => {
  it('returns 401 without a session', async () => {
    sessionMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(listMock).not.toHaveBeenCalled();
  });

  it('lists movements as the session user', async () => {
    listMock.mockResolvedValue([{ id: 'm-1' } as never]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith({ user: { id: 'user-1' } });
    await expect(response.json()).resolves.toEqual({
      data: [{ id: 'm-1' }],
    });
  });
});

describe('POST /api/safebox/movements', () => {
  it('returns 401 without a session', async () => {
    sessionMock.mockResolvedValue(null);

    const response = await postCall(VALID_BODY);

    expect(response.status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('creates a movement as the session user', async () => {
    createMock.mockResolvedValue({
      ok: true,
      movement: { id: 'm-1' },
    } as never);

    const response = await postCall(VALID_BODY);

    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ movementType: 'deposit', amount: 50 }),
      { user: { id: 'user-1' } },
    );
  });

  it('rejects invalid data with 400 and creates nothing', async () => {
    const response = await postCall({ ...VALID_BODY, amount: -5 });

    expect(response.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('requires a note on adjustments', async () => {
    const response = await postCall({
      ...VALID_BODY,
      movementType: 'adjustment',
      amount: -5,
      note: undefined,
    });

    expect(response.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('maps ledger rejections to 409 with the reason', async () => {
    createMock.mockResolvedValue({
      ok: false,
      reason: 'insufficient-funds',
    });

    const response = await postCall({
      ...VALID_BODY,
      movementType: 'withdrawal',
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      reason: 'insufficient-funds',
    });
  });
});

describe('DELETE /api/safebox/movements/[id]', () => {
  it('returns 401 without a session', async () => {
    sessionMock.mockResolvedValue(null);

    const response = await deleteCall('m-1');

    expect(response.status).toBe(401);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('deletes as the session user', async () => {
    deleteMock.mockResolvedValue('deleted');

    const response = await deleteCall('m-1');

    expect(response.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith('m-1', {
      user: { id: 'user-1' },
    });
  });

  it("returns 404 when the movement is not the user's", async () => {
    deleteMock.mockResolvedValue('not-found');

    const response = await deleteCall('m-1');

    expect(response.status).toBe(404);
  });

  it('returns 409 when the deletion would break the balance', async () => {
    deleteMock.mockResolvedValue('insufficient-funds');

    const response = await deleteCall('m-1');

    expect(response.status).toBe(409);
  });
});
