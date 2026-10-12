/** @jest-environment node */

import { getServerSession } from 'next-auth';

import { DELETE, POST, PUT } from '@/app/api/recurring/route';
import {
  createRecurringRecord,
  deleteRecurringRecord,
  updateRecurringRecord,
} from '@/lib/recurring/repo';

// Automock: see __tests__/api/merchants.test.ts for why `next-auth` is not
// mocked with a partial factory.
jest.mock('next-auth');
jest.mock('@/lib/recurring/repo', () => ({
  getRecurringRecords: jest.fn(),
  createRecurringRecord: jest.fn(),
  updateRecurringRecord: jest.fn(),
  deleteRecurringRecord: jest.fn(),
}));
jest.mock('@/lib/server-data', () => ({ ensureCategory: jest.fn() }));

const sessionMock = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const createMock = createRecurringRecord as jest.MockedFunction<
  typeof createRecurringRecord
>;
const updateMock = updateRecurringRecord as jest.MockedFunction<
  typeof updateRecurringRecord
>;
const deleteMock = deleteRecurringRecord as jest.MockedFunction<
  typeof deleteRecurringRecord
>;

function request(method: string, body: string) {
  return new Request('http://localhost/api/recurring', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

const RECORD = {
  name: 'Alquiler',
  accion: 'Gasto',
  tipo: 'Vivienda',
  amount: 800,
  frequency: 'monthly',
  plataforma_pago: 'Transferencia',
};

beforeEach(() => {
  jest.clearAllMocks();
  sessionMock.mockResolvedValue({ user: { id: 'user-1' } } as never);
});

describe('POST /api/recurring', () => {
  it('returns 400 naming the problem when a required field is missing', async () => {
    const { name: _name, ...withoutName } = RECORD;
    const res = await POST(request('POST', JSON.stringify(withoutName)));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Todos los campos son requeridos');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('returns 400 for a body that is not JSON', async () => {
    const res = await POST(request('POST', 'not json'));
    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe('PUT /api/recurring', () => {
  it('returns 400 when the id is missing', async () => {
    const res = await PUT(request('PUT', JSON.stringify(RECORD)));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Todos los campos son requeridos');
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('returns 400 for a body that is not JSON', async () => {
    const res = await PUT(request('PUT', 'not json'));
    expect(res.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/recurring', () => {
  it('returns 200 when the record was deleted', async () => {
    deleteMock.mockResolvedValue(true);
    const res = await DELETE(request('DELETE', JSON.stringify({ id: 'r-1' })));
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith('r-1', 'user-1');
  });

  it('returns 404 when no record matched', async () => {
    deleteMock.mockResolvedValue(false);
    const res = await DELETE(request('DELETE', JSON.stringify({ id: 'r-1' })));
    expect(res.status).toBe(404);
  });

  it('returns 500 when the database fails', async () => {
    deleteMock.mockRejectedValue(new Error('connection reset'));
    const res = await DELETE(request('DELETE', JSON.stringify({ id: 'r-1' })));
    expect(res.status).toBe(500);
  });
});
