/** @jest-environment node */

import { getServerSession } from 'next-auth';

import { POST } from '@/app/api/recurring/generate/route';
import { PreviewMutationError } from '@/lib/demo/mutations';
import { generateFinanceEntries } from '@/lib/recurring/repo';

// Automock: see __tests__/api/merchants.test.ts for why `next-auth` is not
// mocked with a partial factory.
jest.mock('next-auth');
jest.mock('@/lib/recurring/repo', () => ({
  generateFinanceEntries: jest.fn(),
}));

const sessionMock = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const generateMock = generateFinanceEntries as jest.MockedFunction<
  typeof generateFinanceEntries
>;

function request(body: string) {
  return new Request('http://localhost/api/recurring/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  sessionMock.mockResolvedValue({ user: { id: 'user-1' } } as never);
  generateMock.mockResolvedValue({ generated: 2 });
});

describe('POST /api/recurring/generate', () => {
  it('translates a pre-insert generation denial to retryable HTTP guidance', async () => {
    const rejection = {
      ok: false as const,
      code: 'PREVIEW_RATE_LIMIT' as const,
      status: 429 as const,
      error: 'Reintenta en 60 segundos.',
      retryAfter: 60,
    };
    generateMock.mockRejectedValue(new PreviewMutationError(rejection));
    const response = await POST(
      request(JSON.stringify({ date: '2026-10-15' })),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(await response.json()).toEqual(rejection);
  });
  it('returns 401 without a session', async () => {
    sessionMock.mockResolvedValue(null);
    const res = await POST(request(JSON.stringify({ date: '2026-10-15' })));
    expect(res.status).toBe(401);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it('returns 400 when the date is missing', async () => {
    const res = await POST(request(JSON.stringify({})));
    expect(res.status).toBe(400);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it('returns 400 when the date cannot be parsed', async () => {
    const res = await POST(request(JSON.stringify({ date: 'not-a-date' })));
    expect(res.status).toBe(400);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it('returns 400 for a body that is not JSON', async () => {
    const res = await POST(request('not json'));
    expect(res.status).toBe(400);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it('generates entries for the year and month of the given date', async () => {
    const res = await POST(request(JSON.stringify({ date: '2026-10-15' })));
    expect(res.status).toBe(200);
    expect(generateMock).toHaveBeenCalledWith(
      'user-1',
      '2026-10-15',
      2026,
      10,
      expect.any(Function),
    );
    expect(await res.json()).toMatchObject({ success: true, generated: 2 });
  });

  it('does not leak the internal error message on failure', async () => {
    generateMock.mockRejectedValue(
      new Error('relation "finance_entries" does not exist'),
    );
    const res = await POST(request(JSON.stringify({ date: '2026-10-15' })));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to generate recurring records' });
    expect(JSON.stringify(body)).not.toContain('finance_entries');
  });
});
