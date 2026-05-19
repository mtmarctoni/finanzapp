import { formatCurrency, formatDate, escapeLikePattern } from '@/lib/utils';

describe('Utils', () => {
  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      expect(formatCurrency(1000)).toMatch(/^1000,00\s*€$/);
      expect(formatCurrency(1234.56)).toMatch(/^1234,56\s*€$/);
      expect(formatCurrency(0)).toMatch(/^0,00\s*€$/);
      expect(formatCurrency(-500)).toMatch(/^\-500,00\s*€$/);
    });
  });

  describe('formatDate', () => {
    it('should format date correctly', () => {
      expect(formatDate('2023-01-15')).toMatch(/\d{2}\/\d{2}\/\d{4}/);

      const date = new Date('2023-01-15');
      expect(formatDate(date.toISOString())).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('should handle invalid dates', () => {
      expect(formatDate('invalid-date')).toBe('Invalid Date');
    });
  });

  describe('escapeLikePattern', () => {
    it('escapes percent signs', () => {
      expect(escapeLikePattern('100%')).toBe('100\\%');
    });

    it('escapes underscores', () => {
      expect(escapeLikePattern('hello_world')).toBe('hello\\_world');
    });

    it('escapes backslashes', () => {
      expect(escapeLikePattern('path\\to\\file')).toBe('path\\\\to\\\\file');
    });

    it('escapes all three special chars in one string', () => {
      expect(escapeLikePattern('a%b_c\\d')).toBe('a\\%b\\_c\\\\d');
    });

    it('passes through plain strings unchanged', () => {
      expect(escapeLikePattern('grocery')).toBe('grocery');
    });

    it('handles empty string', () => {
      expect(escapeLikePattern('')).toBe('');
    });

    it('escapes SQL injection attempt with percent wildcards', () => {
      expect(escapeLikePattern('$$$%___')).toBe('$$$\\%\\_\\_\\_');
    });
  });
});
