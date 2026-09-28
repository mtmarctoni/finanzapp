/** @jest-environment node */

import {
  findMerchantByNormalizedName,
  type MerchantRecord,
} from '@/lib/merchants/repo';
import { resolveMerchantClassification } from '@/lib/receipts/resolve';

jest.mock('@/lib/merchants/repo', () => ({
  findMerchantByNormalizedName: jest.fn(),
  isTrustedMerchant: (m: MerchantRecord) =>
    m.veces_confirmado > 0 || m.veces_corregido > 0,
}));

const findMock = findMerchantByNormalizedName as jest.MockedFunction<
  typeof findMerchantByNormalizedName
>;

function merchant(overrides: Partial<MerchantRecord> = {}): MerchantRecord {
  return {
    id: 'm-1',
    canonical_name: 'Mercadona',
    normalized_name: 'mercadona',
    tipo: 'Supermercado',
    plataforma_pago: 'Tarjeta',
    veces_visto: 3,
    veces_confirmado: 2,
    veces_corregido: 0,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  findMock.mockResolvedValue(null);
  // The "outside the standard list" cases make `normalizeCategory` warn on
  // purpose; keep the suite output clean without hiding anything else.
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('resolveMerchantClassification', () => {
  it('lets a trusted merchant override the model', async () => {
    findMock.mockResolvedValue(
      merchant({ tipo: 'Limpieza', veces_confirmado: 4 }),
    );
    const result = await resolveMerchantClassification({
      userId: 'u-1',
      comercio: 'MERCADONA S.A. 1234',
      modelTipo: 'Supermercado',
      modelPlataformaPago: 'Visa',
    });
    expect(result.tipo).toBe('Limpieza');
    expect(result.source).toBe('memory');
    expect(result.merchantId).toBe('m-1');
    expect(result.trusted).toBe(true);
  });

  it('looks the merchant up by its normalized name', async () => {
    await resolveMerchantClassification({
      userId: 'u-1',
      comercio: 'MERCADONA S.A. 1234 MADRID',
      modelTipo: 'Supermercado',
      modelPlataformaPago: '',
    });
    expect(findMock).toHaveBeenCalledWith('mercadona madrid', 'u-1');
  });

  it('lets the model beat a merchant the user never confirmed', async () => {
    findMock.mockResolvedValue(
      merchant({ tipo: 'Limpieza', veces_confirmado: 0, veces_corregido: 0 }),
    );
    const result = await resolveMerchantClassification({
      userId: 'u-1',
      comercio: 'Mercadona',
      modelTipo: 'Supermercado',
      modelPlataformaPago: '',
    });
    expect(result.tipo).toBe('Supermercado');
    expect(result.source).toBe('model');
    expect(result.trusted).toBe(false);
  });

  it('uses an unconfirmed merchant only when the model said nothing', async () => {
    findMock.mockResolvedValue(
      merchant({ tipo: 'Limpieza', veces_confirmado: 0 }),
    );
    const result = await resolveMerchantClassification({
      userId: 'u-1',
      comercio: 'Mercadona',
      modelTipo: '',
      modelPlataformaPago: '',
    });
    expect(result.tipo).toBe('Limpieza');
    expect(result.source).toBe('seen_guess');
  });

  it('normalizes the model answer through the category aliases', async () => {
    const result = await resolveMerchantClassification({
      userId: 'u-1',
      comercio: 'Corner Store',
      modelTipo: 'groceries',
      modelPlataformaPago: '',
    });
    expect(result.tipo).toBe('Supermercado');
    expect(result.source).toBe('alias');
  });

  // `normalizeCategory` is a normalizer, not a validator: an input it does
  // not recognise comes back **unchanged** (`lib/categories.ts` logs a warning
  // and returns the raw string). So "the model said something" is not proof of
  // "the model said a valid category" — see the gate in the implementation.
  it('refuses a model category that is outside the standard list', async () => {
    const result = await resolveMerchantClassification({
      userId: 'u-1',
      comercio: 'Corner Store',
      modelTipo: 'grocery',
      modelPlataformaPago: '',
    });
    expect(result.tipo).toBe('Otros gastos');
    expect(result.source).toBe('default');
  });

  it('prefers the seen guess over a model category outside the list', async () => {
    findMock.mockResolvedValue(
      merchant({ tipo: 'Limpieza', veces_confirmado: 0 }),
    );
    const result = await resolveMerchantClassification({
      userId: 'u-1',
      comercio: 'Mercadona',
      modelTipo: 'grocery',
      modelPlataformaPago: '',
    });
    expect(result.tipo).toBe('Limpieza');
    expect(result.source).toBe('seen_guess');
  });

  it('falls back to Otros gastos when nothing is known', async () => {
    const result = await resolveMerchantClassification({
      userId: 'u-1',
      comercio: '???',
      modelTipo: '',
      modelPlataformaPago: '',
    });
    expect(result.tipo).toBe('Otros gastos');
    expect(result.source).toBe('default');
    expect(result.merchantId).toBeNull();
  });

  it('does not query the database for an unreadable merchant name', async () => {
    await resolveMerchantClassification({
      userId: 'u-1',
      comercio: '   ',
      modelTipo: 'Supermercado',
      modelPlataformaPago: '',
    });
    expect(findMock).not.toHaveBeenCalled();
  });

  // The asymmetry: the ticket beats memory for the payment method.
  it('keeps the payment method the model read from this receipt', async () => {
    findMock.mockResolvedValue(merchant({ plataforma_pago: 'Tarjeta' }));
    const result = await resolveMerchantClassification({
      userId: 'u-1',
      comercio: 'Mercadona',
      modelTipo: 'Supermercado',
      modelPlataformaPago: 'Visa',
    });
    expect(result.plataforma_pago).toBe('Visa');
  });

  it('falls back to the remembered payment method when the receipt omits it', async () => {
    findMock.mockResolvedValue(merchant({ plataforma_pago: 'Tarjeta' }));
    const result = await resolveMerchantClassification({
      userId: 'u-1',
      comercio: 'Mercadona',
      modelTipo: 'Supermercado',
      modelPlataformaPago: '   ',
    });
    expect(result.plataforma_pago).toBe('Tarjeta');
  });
});
