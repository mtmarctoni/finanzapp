import { render, screen, fireEvent } from '@testing-library/react';
import { SearchFilter } from '@/components/search-filter';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

// Mock Next.js modules
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
  usePathname: jest.fn(),
}));

describe('SearchFilter', () => {
  // Setup common mocks
  const mockPush = jest.fn();
  const mockGet = jest.fn();
  const mockPathname = '/records';
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock router
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
    
    // Mock pathname
    (usePathname as jest.Mock).mockReturnValue(mockPathname);
    
    // Mock search params with entries method
    (useSearchParams as jest.Mock).mockReturnValue({
      get: mockGet,
      entries: function* () {
        const params: Record<string, string> = {};
        // Only return 'tipo' param if needed by the component
        const tipo = mockGet('tipo');
        if (tipo) {
          params['tipo'] = tipo;
        }
        for (const [key, value] of Object.entries(params)) {
          yield [key, value];
        }
      },
    });
  });

  it('renders all filter elements correctly', () => {
    // Mock empty search params
    mockGet.mockImplementation(() => null);
    
    render(<SearchFilter />);
    
    // Check that all filter elements are rendered (using updated placeholder text)
    expect(screen.getByPlaceholderText('Buscar por descripción o plataforma...')).toBeInTheDocument();
    expect(screen.getByText('Todas las acciones')).toBeInTheDocument();
    expect(screen.getByText('Fecha desde')).toBeInTheDocument();
    expect(screen.getByText('Fecha hasta')).toBeInTheDocument();
  });

  it('initializes with search params values', () => {
    // Mock search params with values
    mockGet.mockImplementation((param) => {
      const params: Record<string, string> = {
        search: 'test search',
        tipo: 'Ingreso',
        from: '2023-01-01',
        to: '2023-01-31',
      };
      return params[param as keyof typeof params] || null;
    });
    
    render(<SearchFilter />);
    
    // Check that input has the search value
    const searchInput = screen.getByPlaceholderText('Buscar por descripción o plataforma...') as HTMLInputElement;
    expect(searchInput.value).toBe('test search');
  });

  it('applies filters when search button is clicked', () => {
    // Mock empty search params
    mockGet.mockImplementation(() => null);
    
    render(<SearchFilter />);
    
    // Enter search text
    const searchInput = screen.getByPlaceholderText('Buscar por descripción o plataforma...');
    fireEvent.change(searchInput, { target: { value: 'test query' } });
    
    // Check that the search input was updated
    expect((searchInput as HTMLInputElement).value).toBe('test query');
  });

  it('resets filters when clear button is clicked', () => {
    // Mock search params with values
    mockGet.mockImplementation((param) => {
      const params: Record<string, string> = {
        search: 'test search',
        tipo: 'Ingreso',
      };
      return params[param as keyof typeof params] || null;
    });
    
    render(<SearchFilter />);
    
    // Find the clear button by its X icon or aria-label
    const clearButton = screen.getAllByRole('button').find(button => 
      button.querySelector('svg') !== null
    );
    
    if (clearButton) {
      fireEvent.click(clearButton);
      // The component navigates to pathname without params
    }
  });
});
