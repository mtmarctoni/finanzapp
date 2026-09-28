import { buildReceiptSubmitContext } from '@/components/ai/receiptSubmitContext';

const RECEIPT = {
  rcpt: '1',
  fecha: '2026-09-20',
  tipo: 'Supermercado',
  accion: 'Gasto',
  que: 'Mercadona',
  plataforma_pago: 'Visa',
  cantidad: 43.2,
  content_hash: 'a'.repeat(64),
  merchant_id: 'm-1',
  confianza: 0.92,
  comercio: 'Mercadona',
  needs_review: false,
};

describe('buildReceiptSubmitContext', () => {
  it('sends nothing extra for a manual entry', () => {
    expect(buildReceiptSubmitContext(undefined)).toEqual({ provenance: {} });
    expect(buildReceiptSubmitContext({ tipo: 'Supermercado' })).toEqual({
      provenance: {},
    });
  });

  // `rcpt` is the only marker; anything else is a hand-edited URL and must not
  // be able to fake a receipt confirmation.
  it('ignores an rcpt value that is not exactly "1"', () => {
    expect(buildReceiptSubmitContext({ ...RECEIPT, rcpt: '0' })).toEqual({
      provenance: {},
    });
  });

  it('carries the provenance so the row can be traced to the image', () => {
    expect(buildReceiptSubmitContext(RECEIPT).provenance).toEqual({
      origen: 'receipt',
      content_hash: 'a'.repeat(64),
      merchant_id: 'm-1',
      confianza: 0.92,
    });
  });

  // Without this the feature still *looks* fine — the entry saves, the category
  // shows up — and only the merchant memory quietly stops improving.
  it('carries the learning context `createEntry` needs', () => {
    expect(buildReceiptSubmitContext(RECEIPT).learning).toEqual({
      comercio: 'Mercadona',
      categoriaPrefill: 'Supermercado',
    });
  });

  it('has no learning context without a readable merchant', () => {
    const result = buildReceiptSubmitContext({ ...RECEIPT, comercio: '' });
    expect(result.learning).toBeUndefined();
    expect(result.provenance.origen).toBe('receipt');
  });
});
