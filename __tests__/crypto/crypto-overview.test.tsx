import { render, screen, waitFor } from '@testing-library/react';

import { CryptoOverview } from '@/components/crypto/crypto-overview';
import { getCryptoOverview } from '@/lib/crypto-data';
import type { CryptoPortfolioOverview } from '@/types/finance';

jest.mock('@/lib/crypto-data', () => ({
  getCryptoOverview: jest.fn(),
}));

const mockGetCryptoOverview = getCryptoOverview as jest.Mock;

const overviewFixture: CryptoPortfolioOverview = {
  positions: [
    {
      symbol: 'BTC',
      amount: 0.5,
      costBasis: 15000,
      averageCost: 30000,
      realizedPL: 500,
      price: {
        symbol: 'BTC',
        priceEur: 60000,
        fetchedAt: '2026-08-22T10:00:00.000Z',
        stale: false,
        priceKnown: true,
      },
      currentValue: 30000,
      unrealizedPL: 15000,
      unrealizedPLPercent: 100,
    },
  ],
  totals: {
    totalValue: 30000,
    totalCostBasis: 15000,
    unrealizedPL: 15000,
    unrealizedPLPercent: 100,
    realizedPL: 500,
  },
  pricesUpdatedAt: '2026-08-22T10:00:00.000Z',
  missingPrices: [],
};

describe('CryptoOverview', () => {
  beforeEach(() => {
    mockGetCryptoOverview.mockReset();
  });

  it('renders stat cards and the holdings table with P/L formatting', async () => {
    mockGetCryptoOverview.mockResolvedValue(overviewFixture);

    render(<CryptoOverview />);

    await waitFor(() => {
      expect(screen.getByText('Valor actual')).toBeInTheDocument();
    });

    expect(screen.getByText('Invertido (coste)')).toBeInTheDocument();
    expect(screen.getByText('P/L no realizado')).toBeInTheDocument();
    expect(screen.getByText('P/L realizado')).toBeInTheDocument();

    const btcRow = screen.getByText('BTC').closest('tr');
    expect(btcRow).toHaveTextContent('0,5');
    expect(btcRow).toHaveTextContent('+15.000,00 €');
    expect(btcRow).toHaveTextContent('(100.0%)');
  });

  it('warns about symbols without CoinGecko prices', async () => {
    mockGetCryptoOverview.mockResolvedValue({
      ...overviewFixture,
      totals: {
        totalValue: null,
        totalCostBasis: 15000,
        unrealizedPL: null,
        unrealizedPLPercent: null,
        realizedPL: 500,
      },
      missingPrices: ['XYZ'],
    });

    render(<CryptoOverview />);

    await waitFor(() => {
      expect(
        screen.getByText(/Sin precio en CoinGecko: XYZ/),
      ).toBeInTheDocument();
    });
  });

  it('shows an empty state when there is no crypto activity', async () => {
    mockGetCryptoOverview.mockResolvedValue({
      positions: [],
      totals: {
        totalValue: 0,
        totalCostBasis: 0,
        unrealizedPL: 0,
        unrealizedPLPercent: 0,
        realizedPL: 0,
      },
      pricesUpdatedAt: null,
      missingPrices: [],
    });

    render(<CryptoOverview />);

    await waitFor(() => {
      expect(
        screen.getByText(/Aún no hay transacciones de criptomonedas/),
      ).toBeInTheDocument();
    });
  });

  it('shows an error card with retry when fetching fails', async () => {
    mockGetCryptoOverview.mockResolvedValue(null);

    render(<CryptoOverview />);

    await waitFor(() => {
      expect(
        screen.getByText(/No se pudo cargar el resumen/),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: /Reintentar/ }),
    ).toBeInTheDocument();
  });
});
