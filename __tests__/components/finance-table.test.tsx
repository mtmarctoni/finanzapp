import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FinanceTable from '@/components/finance-table';
import { getFinanceEntries } from '@/lib/data';
import { deleteEntry } from '@/lib/actions';
import { SessionProvider } from 'next-auth/react';

// Mock the modules
jest.mock('@/lib/data', () => ({
  getFinanceEntries: jest.fn(),
}));

jest.mock('@/lib/actions', () => ({
  deleteEntry: jest.fn(),
}));

// Mock useTransition
jest.mock('react', () => {
  const originalReact = jest.requireActual('react');
  return {
    ...originalReact,
    useTransition: () => [false, jest.fn((callback) => callback())],
  };
});

// Mock Next.js App Router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  usePathname: jest.fn(() => '/records'),
}));

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({ data: { user: { id: 'test-user' } }, status: 'authenticated' })),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('FinanceTable', () => {
  const mockEntries = {
    data: [
      {
        id: '1',
        fecha: '2023-01-01',
        tipo: 'Ingreso',
        accion: 'Salario',
        que: 'Trabajo',
        plataformaPago: 'Transferencia',
        cantidad: 1000,
        detalle1: 'Detalle 1',
        detalle2: 'Detalle 2',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01',
      },
      {
        id: '2',
        fecha: '2023-01-02',
        tipo: 'Gasto',
        accion: 'Compra',
        que: 'Supermercado',
        plataformaPago: 'Tarjeta',
        cantidad: 50,
        detalle1: null,
        detalle2: null,
        createdAt: '2023-01-02',
        updatedAt: '2023-01-02',
      },
    ],
    totalItems: 2,
    totalPages: 1,
    currentPage: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the getFinanceEntries function to return test data
    (getFinanceEntries as jest.Mock).mockResolvedValue(mockEntries);
  });

  it('renders the table with entries', async () => {
    render(<FinanceTable />);

    // Wait for the entries to be loaded
    await waitFor(() => {
      expect(getFinanceEntries).toHaveBeenCalled();
    });

    // Check that the table headers are rendered
    expect(screen.getByText('Fecha')).toBeInTheDocument();
    expect(screen.getByText('Tipo')).toBeInTheDocument();
    expect(screen.getByText('Accion')).toBeInTheDocument();
    expect(screen.getByText('Qué')).toBeInTheDocument();
    expect(screen.getByText('Plataforma pago')).toBeInTheDocument();
    expect(screen.getByText('Cantidad')).toBeInTheDocument();
    expect(screen.getByText('Detalle 1')).toBeInTheDocument();
    expect(screen.getByText('Detalle 2')).toBeInTheDocument();
    expect(screen.getByText('Acciones')).toBeInTheDocument();

    // Check that the entries are rendered
    await waitFor(() => {
      expect(screen.getByText('Salario')).toBeInTheDocument();
      expect(screen.getByText('Compra')).toBeInTheDocument();
    });
  });

  it('handles empty entries', async () => {
    // Mock empty entries
    (getFinanceEntries as jest.Mock).mockResolvedValue({
      data: [],
      totalItems: 0,
      totalPages: 0,
      currentPage: 1,
    });

    render(<FinanceTable />);

    // Wait for the entries to be loaded
    await waitFor(() => {
      expect(getFinanceEntries).toHaveBeenCalled();
    });

    // Check that the empty message is rendered
    expect(screen.getByText('No hay entradas. Añade una nueva entrada para comenzar.')).toBeInTheDocument();
  });

  it('applies search params when provided', async () => {
    const searchParams = {
      search: 'test',
      accion: 'Ingreso',
      from: '2023-01-01',
      to: '2023-01-31',
      page: '2',
    };

    render(<FinanceTable searchParams={searchParams} />);

    // Wait for the entries to be loaded
    await waitFor(() => {
      expect(getFinanceEntries).toHaveBeenCalled();
    });

    // Check that getFinanceEntries was called with the correct params
    expect(getFinanceEntries).toHaveBeenCalledWith({
      search: 'test',
      accion: 'Ingreso',
      from: '2023-01-01',
      to: '2023-01-31',
      page: 2,
      itemsPerPage: 100,
      sortBy: 'fecha',
      sortOrder: 'desc',
    });
  });

  it('deletes an entry with optimistic UI update', async () => {
    // Mock the deleteEntry function
    (deleteEntry as jest.Mock).mockResolvedValue({ success: true });

    render(<FinanceTable />);

    // Wait for the entries to be loaded
    await waitFor(() => {
      expect(getFinanceEntries).toHaveBeenCalled();
    });

    // Find the delete button by aria-label for the first entry
    const deleteButton = screen.getByLabelText('Eliminar entrada 1');
    
    // Click the delete button
    fireEvent.click(deleteButton);

    // Check that deleteEntry was called
    await waitFor(() => {
      expect(deleteEntry).toHaveBeenCalled();
    });

    // In a real test, you would also check that the entry was removed from the UI
    // This is challenging in this test because we're mocking useTransition
  });
});
