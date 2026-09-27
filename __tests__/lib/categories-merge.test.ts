import { STANDARD_CATEGORIES, mergeCategoryOptions } from '@/lib/categories';

describe('mergeCategoryOptions', () => {
  it('keeps the historical order first, then appends missing standard categories', () => {
    const result = mergeCategoryOptions(['Comida', 'Ocio']);
    expect(result.slice(0, 2)).toEqual(['Comida', 'Ocio']);
    expect(result).toContain('Farmacia');
    expect(result.length).toBe(
      2 +
        STANDARD_CATEGORIES.filter((c) => !['Comida', 'Ocio'].includes(c))
          .length,
    );
  });

  it('does not duplicate a standard category the user already uses', () => {
    const result = mergeCategoryOptions(['Supermercado', 'Gasolina']);
    expect(result.filter((c) => c === 'Supermercado')).toHaveLength(1);
    expect(result.filter((c) => c === 'Gasolina')).toHaveLength(1);
  });

  it('keeps the historical spelling when it only differs by case', () => {
    const result = mergeCategoryOptions(['farmacia']);
    expect(result[0]).toBe('farmacia');
    expect(result.filter((c) => c.toLowerCase() === 'farmacia')).toHaveLength(
      1,
    );
  });

  it('drops empty and whitespace-only entries', () => {
    const result = mergeCategoryOptions(['Cine', '', '   ']);
    expect(result).toContain('Cine');
    expect(result).not.toContain('');
    expect(result).not.toContain('   ');
  });

  it('returns every standard category for a user with no history', () => {
    expect(mergeCategoryOptions([])).toEqual([...STANDARD_CATEGORIES]);
  });
});
