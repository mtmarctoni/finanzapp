import { act, fireEvent, render, screen } from '@testing-library/react';
import { format } from 'date-fns';

import Dashboard from '@/components/dashboard';

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: { user: { id: 'test-user', name: 'Ana' } },
    status: 'authenticated',
  })),
}));

jest.mock('@/components/quick-add/quick-add-context', () => ({
  useQuickAdd: () => ({ open: jest.fn(), close: jest.fn(), isOpen: false }),
}));

jest.mock('@/components/monthly-trends-chart', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/lib/data', () => ({
  getFinanceEntries: jest.fn().mockResolvedValue({ data: [] }),
}));

const emptyBreakdown = { total: 0, categories: [], averageMonthly: 0 };

function stats(overrides: Record<string, number>) {
  return {
    totalIncome: 0,
    incomeCount: 0,
    totalExpense: 0,
    expenseCount: 0,
    totalInvestment: 0,
    investmentCount: 0,
    balance: 0,
    monthlyTrends: [],
    savingsRate: 0,
    expenseBreakdown: emptyBreakdown,
    incomeBreakdown: emptyBreakdown,
    ...overrides,
  };
}

// No records at all: the hero reads "Aún no hay registros en ...".
const emptyMonth = stats({});
// Expenses but no income: the hero reads "Sin ingresos registrados en ...".
const spendingMonth = stats({
  totalExpense: 40,
  expenseCount: 1,
  balance: -40,
});

function ok(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

const currentMonth = format(new Date(), 'yyyy-MM-01');
const now = new Date();
const previousMonth = format(
  new Date(now.getFullYear(), now.getMonth() - 1, 1),
  'yyyy-MM-01',
);

const monthOf = (url: string) =>
  new URL(url, 'http://localhost').searchParams.get('month');

describe('Dashboard', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('keeps the selected month when an earlier month answers late', async () => {
    let resolveCurrent: (response: Response) => void = () => undefined;
    fetchMock.mockImplementation(async (url: string) =>
      monthOf(url) === currentMonth
        ? new Promise((resolve) => {
            resolveCurrent = resolve;
          })
        : Promise.resolve(ok(spendingMonth)),
    );

    render(<Dashboard />);
    await act(async () => undefined);

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: previousMonth },
    });
    expect(
      await screen.findByText(/Sin ingresos registrados/),
    ).toBeInTheDocument();

    await act(async () => {
      resolveCurrent(ok(emptyMonth));
    });

    expect(screen.getByText(/Sin ingresos registrados/)).toBeInTheDocument();
    expect(screen.queryByText(/Aún no hay registros/)).not.toBeInTheDocument();
  });

  it('shows an error with a retry instead of loading forever', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false } as Response);

    render(<Dashboard />);

    expect(
      await screen.findByText('No se pudo cargar el resumen del mes.'),
    ).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(ok(spendingMonth));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByText(/Sin ingresos registrados/),
    ).toBeInTheDocument();
  });
});
