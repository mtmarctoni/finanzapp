import { normalizeMerchantName } from '@/lib/merchants/normalize';

describe('normalizeMerchantName', () => {
  // Review Focus #4: spelling noise must collapse to one key, but a branch
  // label must survive it. The last two rows are the ones that matter.
  it.each([
    ['Mercadona', 'mercadona'],
    ['MERCADONA', 'mercadona'],
    ['  Mercadona  ', 'mercadona'],
    ['Mercad0na', 'mercadona'],
    ['MERCADONA S.A.', 'mercadona'],
    ['MERCADONA S.A. 1234 MADRID', 'mercadona madrid'],
    ['MERCADONA*DON', 'mercadona don'],
    ['Mercadona SLU', 'mercadona'],
    ['Café Central', 'cafe central'],
    ['CAFE CENTRAL', 'cafe central'],
    ['Restaurante Ñandú', 'restaurante nandu'],
    ['Media-Markt', 'media markt'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeMerchantName(input)).toBe(expected);
  });

  it('keeps the store label after the chain name', () => {
    // Two branches of one chain are two memory rows, not one.
    expect(normalizeMerchantName('MERCADONA*DON')).toBe('mercadona don');
    expect(normalizeMerchantName('MERCADONA DON')).toBe('mercadona don');
    // Punctuation between the chain and the label is noise...
    expect(normalizeMerchantName('MERCADONA DON')).toBe('mercadona don');
    // ...but the label itself is not.
    expect(normalizeMerchantName('MERCADONA DON')).not.toBe(
      normalizeMerchantName('MERCADONA S.A. 1234 MADRID'),
    );
  });

  it('returns an empty string for empty or whitespace input', () => {
    expect(normalizeMerchantName('')).toBe('');
    expect(normalizeMerchantName('   ')).toBe('');
  });

  it('strips accents and case but keeps non-ascii letters as folded ascii', () => {
    expect(normalizeMerchantName('MÜLLER')).toBe('muller');
  });
});
