import { getFinanceEntries, getEntryById, getSummaryStats } from '@/lib/data';
import { Entry } from '@/lib/definitions';

const baseURL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

// Mock fetch globally
global.fetch = jest.fn();

// Mock window.location.origin
Object.defineProperty(window, 'location', {
  value: {
    origin: baseURL
  },
  writable: true
});

describe('Data fetching functions', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('getFinanceEntries', () => {
    it('should fetch entries with correct parameters', async () => {
      // Mock successful response
      const mockResponse = {
        data: [{ id: '1', fecha: '2023-01-01', tipo: 'Ingreso' }],
        totalItems: 1,
        totalPages: 1,
        currentPage: 1
      };
      
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // Call the function with search parameters
      const result = await getFinanceEntries({ 
        search: 'test', 
        tipo: 'Ingreso', 
        from: '2023-01-01', 
        to: '2023-01-31', 
        page: 2 
      });

      // Check that fetch was called with correct URL
      expect(fetch).toHaveBeenCalledWith(
        `${baseURL}/api/entries?search=test&tipo=Ingreso&from=2023-01-01&to=2023-01-31&page=2`
      );
      
      // Check that the function returns the expected result
      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors gracefully', async () => {
      // Mock failed response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      // Call the function
      const result = await getFinanceEntries();

      // Check that it returns an empty result with default values
      expect(result).toEqual({
        data: [],
        totalItems: 0,
        totalPages: 0,
        currentPage: 1,
      });
    });
  });

  describe('getEntryById', () => {
    it('should fetch a single entry by ID', async () => {
      // Mock entry data
      const mockEntry: Entry = {
        id: '123',
        fecha: '2023-01-01',
        tipo: 'Ingreso',
        accion: 'Salario',
        que: 'Trabajo',
        plataformaPago: 'Transferencia',
        cantidad: 1000,
        detalle1: null,
        detalle2: null,
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      };

      // Mock successful response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockEntry
      });

      // Call the function
      const result = await getEntryById('123');

      // Check that fetch was called with correct URL
      expect(fetch).toHaveBeenCalledWith(`${baseURL}/api/entries/123`);
      
      // Check that the function returns the expected result
      expect(result).toEqual(mockEntry);
    });

    it('should return null when entry is not found', async () => {
      // Mock error response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      // Call the function
      const result = await getEntryById('non-existent');

      // Check that it returns null
      expect(result).toBeNull();
    });
  });

  describe('getSummaryStats', () => {
    it('should fetch summary statistics', async () => {
      // Mock stats data
      const mockStats = {
        totalIncome: 5000,
        incomeCount: 5,
        totalExpense: 3000,
        expenseCount: 10,
        totalInvestment: 2000,
        investmentCount: 2,
        balance: 2000
      };

      // Mock successful response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats
      });

      // Call the function
      const result = await getSummaryStats();

      // Check that fetch was called with correct URL
      expect(fetch).toHaveBeenCalledWith(`${baseURL}/api/stats`);
      
      // Check that the function returns the expected result
      expect(result).toEqual(mockStats);
    });

    it('should handle API errors gracefully', async () => {
      // Mock failed response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      // Call the function
      const result = await getSummaryStats();

      // Check that it returns default values
      expect(result).toEqual({
        totalIncome: 0,
        incomeCount: 0,
        totalExpense: 0,
        totalInvestment: 0,
        investmentCount: 0,
        expenseCount: 0,
        balance: 0
      });
    });
  });
});
