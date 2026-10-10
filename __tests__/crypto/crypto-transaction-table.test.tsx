import { act, fireEvent, render, screen } from '@testing-library/react';

import CryptoTransactionTable from '@/components/crypto/crypto-transaction-table';
import {
  deleteCryptoTransaction,
  getCryptoTransactions,
} from '@/lib/crypto-data';
import type { CryptoTransaction } from '@/types/finance';

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: { user: { id: 'test-user' } },
    status: 'authenticated',
  })),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

jest.mock('@/components/crypto/crypto-form-sheet', () => ({
  openCryptoForm: jest.fn(),
  useCryptoChanged: jest.fn(),
}));

jest.mock('@/lib/crypto-data', () => ({
  getCryptoTransactions: jest.fn(),
  deleteCryptoTransaction: jest.fn(),
  duplicateCryptoTransaction: jest.fn(),
}));

const mockGet = getCryptoTransactions as jest.Mock;
const mockDelete = deleteCryptoTransaction as jest.Mock;

function tx(id: string): CryptoTransaction {
  return {
    id,
    recordId: null,
    transactionType: 'deposit',
    cryptoSymbol: 'BTC',
    amount: 1,
    priceAtTransaction: null,
    toCryptoSymbol: null,
    toAmount: null,
    fromWallet: null,
    toWallet: null,
    fee: 0,
    feeCrypto: null,
    notes: null,
    transactionDate: '2026-01-01',
    externalTxId: null,
    userId: 'test-user',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

function page(ids: string[], currentPage = 1) {
  return {
    data: ids.map(tx),
    total: ids.length,
    totalPages: 1,
    currentPage,
  };
}

const rowCheckbox = (id: string) =>
  screen.queryByRole('checkbox', { name: `Seleccionar transacción ${id}` });

describe('CryptoTransactionTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ignores a slow response for a page the user has left', async () => {
    let resolvePageOne: (value: ReturnType<typeof page>) => void = () =>
      undefined;
    mockGet.mockImplementation(async ({ page: requested }: { page: number }) =>
      requested === 1
        ? new Promise((resolve) => {
            resolvePageOne = resolve;
          })
        : Promise.resolve(page(['page-2'], 2)),
    );

    const { rerender } = render(
      <CryptoTransactionTable searchParams={{ page: '1' }} />,
    );
    rerender(<CryptoTransactionTable searchParams={{ page: '2' }} />);

    expect(
      await screen.findByRole('checkbox', {
        name: 'Seleccionar transacción page-2',
      }),
    ).toBeInTheDocument();

    await act(async () => {
      resolvePageOne(page(['page-1'], 1));
    });

    expect(rowCheckbox('page-1')).not.toBeInTheDocument();
    expect(rowCheckbox('page-2')).toBeInTheDocument();
  });

  it('keeps rows whose delete failed and reports them', async () => {
    mockGet.mockResolvedValue(page(['ok', 'broken']));
    mockDelete.mockImplementation(async (id: string) => id === 'ok');

    render(<CryptoTransactionTable />);

    fireEvent.click(
      await screen.findByRole('checkbox', {
        name: 'Seleccionar todas las filas',
      }),
    );
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Eliminar transacciones seleccionadas',
        }),
      );
    });

    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(rowCheckbox('ok')).not.toBeInTheDocument();
    expect(rowCheckbox('broken')).toBeInTheDocument();
    expect(window.alert).toHaveBeenCalledWith(
      'No se pudo eliminar 1 transacción',
    );
  });

  it('reports a failed single delete', async () => {
    mockGet.mockResolvedValue(page(['broken']));
    mockDelete.mockResolvedValue(false);

    render(<CryptoTransactionTable />);

    await screen.findByRole('checkbox', {
      name: 'Seleccionar transacción broken',
    });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
    });

    expect(rowCheckbox('broken')).toBeInTheDocument();
    expect(window.alert).toHaveBeenCalledWith(
      'Error al eliminar la transacción',
    );
  });
});
