/** @jest-environment node */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { DELETE, GET } from '@/app/api/merchants/route';
import { deleteMerchantById, listMerchants } from '@/lib/merchants/repo';

// Automock, not a hand-written factory: `next-auth`'s barrel also exports
// `default`, and a partial factory would leave the real auth route — which
// imports that default — without one. There is no `^@/app/*` entry in
// `jest.config.mjs`, so `@/app/api/auth/[...nextauth]/route` cannot be mocked
// by path at all; the real `authOptions` object is harmless here.
jest.mock('next-auth');
jest.mock('@/lib/merchants/repo', () => ({
  listMerchants: jest.fn(),
  deleteMerchantById: jest.fn(),
}));

const sessionMock = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const listMock = listMerchants as jest.MockedFunction<typeof listMerchants>;
const deleteMock = deleteMerchantById as jest.MockedFunction<
  typeof deleteMerchantById
>;

const MERCHANT = {
  id: 'm-1',
  canonical_name: 'Mercadona',
  normalized_name: 'mercadona',
  tipo: 'Supermercado',
  plataforma_pago: 'Visa',
  veces_visto: 5,
  veces_confirmado: 3,
  veces_corregido: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
  sessionMock.mockResolvedValue({ user: { id: 'user-1' } } as never);
  listMock.mockResolvedValue([MERCHANT]);
  deleteMock.mockResolvedValue(undefined);
});

describe('GET /api/merchants', () => {
  it('returns 401 without a session', async () => {
    sessionMock.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(listMock).not.toHaveBeenCalled();
  });

  it('lists only the current user own merchants', async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith('user-1');
    expect(body.merchants).toEqual([MERCHANT]);
  });

  it('returns an empty list without error', async () => {
    listMock.mockResolvedValue([]);
    const body = await (await GET()).json();
    expect(body.merchants).toEqual([]);
  });
});

describe('DELETE /api/merchants', () => {
  function request(query: string) {
    return new NextRequest(`http://localhost/api/merchants${query}`, {
      method: 'DELETE',
    });
  }

  it('returns 401 without a session', async () => {
    sessionMock.mockResolvedValue(null);
    const res = await DELETE(request('?id=m-1'));
    expect(res.status).toBe(401);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('requires an id', async () => {
    expect((await DELETE(request(''))).status).toBe(400);
  });

  it('scopes the delete to the user', async () => {
    const res = await DELETE(request('?id=m-1'));
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith('m-1', 'user-1');
  });
});
