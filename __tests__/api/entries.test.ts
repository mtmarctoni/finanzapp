/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { GET } from '@/app/api/entries/route';
import { getEntries } from '@/lib/actions';

jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({ handlers: {}, auth: jest.fn() })),
  getServerSession: jest.fn(),
}));
jest.mock('@/lib/actions', () => ({
  getEntries: jest.fn(),
}));

const mockedGetServerSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const mockedGetEntries = getEntries as jest.MockedFunction<typeof getEntries>;

function mockRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/entries?${query}`);
}

describe('GET /api/entries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetServerSession.mockResolvedValue({
      user: { id: 'user-123' },
    } as never);
    mockedGetEntries.mockResolvedValue({
      entries: [],
      total: 0,
      totalPages: 0,
    });
  });

  it('returns 401 when the session is missing', async () => {
    mockedGetServerSession.mockResolvedValue(null);

    const request = mockRequest('tipo=Vivienda');
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Not authenticated');
    expect(mockedGetEntries).not.toHaveBeenCalled();
  });

  it('passes tipo, que and amount filters through to getEntries', async () => {
    const request = mockRequest(
      'tipo=Vivienda&que=Alquiler&minAmount=100&maxAmount=500&search=Hipoteca&accion=Gasto&page=3&itemsPerPage=10&sortBy=cantidad&sortOrder=asc',
    );

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockedGetEntries).toHaveBeenCalledWith(
      {
        search: 'Hipoteca',
        accion: 'Gasto',
        tipo: 'Vivienda',
        que: 'Alquiler',
        minAmount: 100,
        maxAmount: 500,
        from: '',
        to: '',
        page: 3,
        itemsPerPage: 10,
        sortBy: 'cantidad',
        sortOrder: 'asc',
      },
      { user: { id: 'user-123' } },
    );
    expect(json).toMatchObject({
      data: [],
      totalItems: 0,
      totalPages: 0,
      currentPage: 3,
    });
  });

  it('omits amount filters when the query params are absent', async () => {
    const request = mockRequest('tipo=Vivienda');

    const response = await GET(request);
    await response.json();

    expect(response.status).toBe(200);
    expect(mockedGetEntries).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'Vivienda',
        minAmount: undefined,
        maxAmount: undefined,
        que: '',
      }),
      expect.anything(),
    );
  });

  it('returns 500 when the repository throws', async () => {
    mockedGetEntries.mockRejectedValue(new Error('DB down'));

    const request = mockRequest('tipo=Vivienda');
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('Failed to fetch entries');
  });
});
