import { render, screen, fireEvent } from '@testing-library/react';
import { SearchFilter } from '@/components/search-filter';
import { useRouter, useSearchParams } from 'next/navigation';

// Mock Next.js modules
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

describe('SearchFilter', () => {
  // Setup common mocks
  const mockPush = jest.fn();
  const mockGet = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock router
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
    
    // Mock search params
    (useSearchParams as jest.Mock).mockReturnValue({
      get: mockGet,
    });
  });

  it('renders all filter elements correctly', () => {
    // Mock empty search params
    mockGet.mockImplementation(() => null);
    
    render(<SearchFilter />);
    
    // Check that all filter elements are rendered
    expect(screen.getByPlaceholderText('Buscar...')).toBeInTheDocument();
    expect(screen.getByText('Todos los tipos')).toBeInTheDocument();
    expect(screen.getByText('Fecha desde')).toBeInTheDocument();
    expect(screen.getByText('Fecha hasta')).toBeInTheDocument();
    expect(screen.getByText('Buscar')).toBeInTheDocument();
    expect(screen.getByText('Limpiar')).toBeInTheDocument();
  });

  it('initializes with search params values', () => {
    // Mock search params with values
    mockGet.mockImplementation((param) => {
      const params = {
        search: 'test search',
        tipo: 'Ingreso',
        from: '2023-01-01',
        to: '2023-01-31',
      };
      return params[param as keyof typeof params] || null;
    });
    
    render(<SearchFilter />);
    
    // Check that input has the search value
    const searchInput = screen.getByPlaceholderText('Buscar...') as HTMLInputElement;
    expect(searchInput.value).toBe('test search');
  });

  it('applies filters when search button is clicked', () => {
    // Mock empty search params
    mockGet.mockImplementation(() => null);
    
    render(<SearchFilter />);
    
    // Enter search text
    const searchInput = screen.getByPlaceholderText('Buscar...');
    fireEvent.change(searchInput, { target: { value: 'test query' } });
    
    // Select a type
    const typeSelect = screen.getByText('Todos los tipos');
    fireEvent.click(typeSelect);
    // This would need to be adjusted based on how your Select component renders options
    // For this test, we're simplifying
    
    // Click search button
    const searchButton = screen.getByText('Buscar');
    fireEvent.click(searchButton);
    
    // Check that router.push was called with the correct query params
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('search=test+query'));
  });

  it('resets filters when clear button is clicked', () => {
    // Mock search params with values
    mockGet.mockImplementation((param) => {
      const params = {
        search: 'test search',
        tipo: 'Ingreso',
      };
      return params[param as keyof typeof params] || null;
    });
    
    render(<SearchFilter />);
    
    // Click clear button
    const clearButton = screen.getByText('Limpiar');
    fireEvent.click(clearButton);
    
    // Check that router.push was called with the root path
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
