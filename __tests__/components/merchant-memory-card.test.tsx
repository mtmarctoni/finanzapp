import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { MerchantMemoryCard } from '@/components/merchants/MerchantMemoryCard';

function mockFetch(sequence: unknown[]) {
  const calls: RequestInit[] = [];
  let index = 0;
  // `async`, not `() => Promise.resolve(...)`:
  // `@typescript-eslint/promise-function-async` rejects the explicit form.
  const fetchMock = jest
    .fn()
    .mockImplementation(async (_url: string, init: RequestInit) => {
      calls.push(init);
      const payload = sequence[Math.min(index, sequence.length - 1)];
      index += 1;
      return {
        ok: true,
        status: 200,
        json: async () => payload,
      };
    });
  global.fetch = fetchMock as unknown as typeof fetch;
  return { fetchMock, calls };
}

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
});

describe('MerchantMemoryCard', () => {
  it('lists what the app has remembered', async () => {
    mockFetch([{ merchants: [MERCHANT] }]);
    render(<MerchantMemoryCard />);
    expect(await screen.findByText('Mercadona')).toBeInTheDocument();
    expect(screen.getByText('Supermercado')).toBeInTheDocument();
  });

  it('says when there is nothing remembered yet', async () => {
    mockFetch([{ merchants: [] }]);
    render(<MerchantMemoryCard />);
    expect(
      await screen.findByText(/todavía no hemos aprendido/i),
    ).toBeInTheDocument();
  });

  // "1 compras" is the kind of thing that ships unnoticed: nothing breaks,
  // and the counters only reach 1 on a brand-new merchant.
  it('agrees with the count in Spanish', async () => {
    mockFetch([
      {
        merchants: [
          {
            ...MERCHANT,
            veces_visto: 1,
            veces_confirmado: 1,
            veces_corregido: 0,
          },
        ],
      },
    ]);
    render(<MerchantMemoryCard />);
    expect(
      await screen.findByText('1 compra · 1 confirmada'),
    ).toBeInTheDocument();
  });

  it('forgets a merchant and reloads the list', async () => {
    const { fetchMock, calls } = mockFetch([
      { merchants: [MERCHANT] },
      { success: true },
      { merchants: [] },
    ]);
    render(<MerchantMemoryCard />);
    await screen.findByText('Mercadona');

    fireEvent.click(screen.getByRole('button', { name: /olvidar/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(calls[1]?.method).toBe('DELETE');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/merchants?id=m-1');
    expect(
      await screen.findByText(/todavía no hemos aprendido/i),
    ).toBeInTheDocument();
  });
});
