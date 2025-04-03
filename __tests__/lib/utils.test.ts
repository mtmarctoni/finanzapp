import { formatCurrency, formatDate } from '@/lib/utils';

describe('Utils', () => {
  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      expect(formatCurrency(1000)).toBe('1.000,00 €');
      expect(formatCurrency(1234.56)).toBe('1.234,56 €');
      expect(formatCurrency(0)).toBe('0,00 €');
      expect(formatCurrency(-500)).toBe('-500,00 €');
    });
  });

  describe('formatDate', () => {
    it('should format date correctly', () => {
      // Test with ISO string format
      expect(formatDate('2023-01-15')).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      
      // Test with Date object
      const date = new Date('2023-01-15');
      // Convert Date to string for formatDate
      expect(formatDate(date.toISOString())).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('should handle invalid dates', () => {
      expect(formatDate('invalid-date')).toBe('Invalid Date');
    });
  });
});
