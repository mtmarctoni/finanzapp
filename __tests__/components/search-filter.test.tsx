import { render, screen, fireEvent } from '@testing-library/react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

import { SearchFilter } from '@/components/search-filter';

// Mock Next.js modules
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
  usePathname: jest.fn(),
}));

const PLACEHOLDER = 'Buscar por descripción o plataforma...';

describe('SearchFilter', () => {
  const mockPush = jest.fn();

  const withParams = (values: Record<string, string>) => {
    const params = new URLSearchParams(values);
    (useSearchParams as jest.Mock).mockReturnValue(params);
  };

  /** The URL the component last navigated to, as URLSearchParams. */
  const lastPushed = () => {
    const url = mockPush.mock.calls.at(-1)?.[0] as string;
    const [path, query = ''] = url.split('?');
    return { path, params: new URLSearchParams(query) };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (usePathname as jest.Mock).mockReturnValue('/records');
    withParams({});
  });

  it('renders the search field and the filter chips', () => {
    render(<SearchFilter />);

    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument();
    for (const name of [
      'Todos',
      'Gastos',
      'Ingresos',
      'Inversiones',
      'Este mes',
      '3 meses',
      '6 meses',
      '1 año',
      'Fechas',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Nothing to clear yet
    expect(
      screen.queryByRole('button', { name: 'Limpiar' }),
    ).not.toBeInTheDocument();
  });

  it('initializes with search params values', () => {
    withParams({ search: 'test search', accion: 'Ingreso' });

    render(<SearchFilter />);

    expect(
      (screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement).value,
    ).toBe('test search');
    expect(screen.getByRole('button', { name: 'Ingresos' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('applies the search on submit and resets pagination', () => {
    withParams({ page: '3' });
    render(<SearchFilter />);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: 'test query' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    const { path, params } = lastPushed();
    expect(path).toBe('/records');
    expect(params.get('search')).toBe('test query');
    expect(params.get('page')).toBe('1');
  });

  it('applies the type filter as soon as a chip is tapped', () => {
    render(<SearchFilter />);

    fireEvent.click(screen.getByRole('button', { name: 'Gastos' }));
    expect(lastPushed().params.get('accion')).toBe('Gasto');

    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    expect(lastPushed().params.has('accion')).toBe(false);
  });

  it('sets from/to for a period preset', () => {
    render(<SearchFilter />);

    fireEvent.click(screen.getByRole('button', { name: 'Este mes' }));

    const { params } = lastPushed();
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    expect(params.get('from')).toBe(`${now.getFullYear()}-${month}-01`);
    expect(params.get('to')).toMatch(
      new RegExp(`^${now.getFullYear()}-${month}-\\d{2}$`),
    );
    expect(screen.getByRole('button', { name: 'Este mes' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('applies a custom date range from the dates sheet', () => {
    render(<SearchFilter />);

    fireEvent.click(screen.getByRole('button', { name: 'Fechas' }));
    fireEvent.change(screen.getByLabelText('Desde'), {
      target: { value: '2023-01-01' },
    });
    fireEvent.change(screen.getByLabelText('Hasta'), {
      target: { value: '2023-01-31' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    const { params } = lastPushed();
    expect(params.get('from')).toBe('2023-01-01');
    expect(params.get('to')).toBe('2023-01-31');
    expect(params.get('page')).toBe('1');
  });

  it('resets every filter when Limpiar is clicked', () => {
    withParams({
      search: 'test search',
      accion: 'Ingreso',
      from: '2023-01-01',
      to: '2023-01-31',
    });
    render(<SearchFilter />);

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));

    expect(mockPush).toHaveBeenLastCalledWith('/records?page=1');
    expect(
      (screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement).value,
    ).toBe('');
  });
});
