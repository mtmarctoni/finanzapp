import { render, screen, waitFor } from '@testing-library/react';
import { CryptoTransactionForm } from '@/components/crypto/crypto-transaction-form';

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: { user: { id: 'test-user' } },
    status: 'authenticated',
  })),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
  })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  usePathname: jest.fn(() => '/investment/crypto/new'),
}));

jest.mock('@/lib/crypto-data', () => ({
  getCryptoOptions: jest.fn().mockResolvedValue({
    cryptoSymbols: ['BTC', 'ETH'],
    wallets: ['Wallet1', 'Wallet2'],
    transactionTypes: [
      { value: 'deposit', label: 'Depósito' },
      { value: 'genesis', label: 'Génesis' },
    ],
  }),
  createCryptoTransaction: jest.fn(),
  updateCryptoTransaction: jest.fn(),
}));

describe('CryptoTransactionForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the form title', async () => {
    render(<CryptoTransactionForm />);

    await waitFor(() => {
      expect(screen.getByText('Nueva Transacción Cripto')).toBeInTheDocument();
    });
  });
});
