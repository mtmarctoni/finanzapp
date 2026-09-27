import { withClient, withPool } from '@/lib/db';
import {
  applyMerchantConfirmation,
  deleteMerchantById,
  findMerchantByNormalizedName,
  isTrustedMerchant,
  listMerchants,
  recordMerchantSeen,
  type MerchantRecord,
} from '@/lib/merchants/repo';

jest.mock('@/lib/db', () => ({
  withClient: jest.fn(),
  withPool: jest.fn(),
}));

const withClientMock = withClient as jest.MockedFunction<typeof withClient>;
const withPoolMock = withPool as jest.MockedFunction<typeof withPool>;

const RECORD: MerchantRecord = {
  id: 'm-1',
  canonical_name: 'Mercadona',
  normalized_name: 'mercadona',
  tipo: 'Supermercado',
  plataforma_pago: 'Tarjeta',
  veces_visto: 3,
  veces_confirmado: 2,
  veces_corregido: 0,
};

function mockWrite(rows: unknown[] = []) {
  const sql = jest.fn().mockResolvedValue({ rows, rowCount: rows.length });
  withClientMock.mockImplementation(async (fn) => fn({ sql } as never));
  return sql;
}

function mockRead(rows: unknown[]) {
  const query = jest.fn().mockResolvedValue({ rows, rowCount: rows.length });
  withPoolMock.mockImplementation(async (fn) => fn({ query } as never));
  return query;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isTrustedMerchant', () => {
  it('is untrusted when neither confirmations nor corrections are recorded', () => {
    expect(
      isTrustedMerchant({ ...RECORD, veces_confirmado: 0, veces_corregido: 0 }),
    ).toBe(false);
  });

  it('is trusted after a single confirmation', () => {
    expect(isTrustedMerchant({ ...RECORD, veces_confirmado: 1 })).toBe(true);
  });

  // Review Focus #5: a correction must not demote the row back to untrusted,
  // or the wrong value keeps being offered and the correction is lost.
  it('stays trusted after a correction', () => {
    expect(
      isTrustedMerchant({
        ...RECORD,
        veces_confirmado: 0,
        veces_corregido: 1,
      }),
    ).toBe(true);
  });
});

describe('findMerchantByNormalizedName', () => {
  it('returns null when there is no row', async () => {
    mockRead([]);
    await expect(
      findMerchantByNormalizedName('mercadona', 'user-1'),
    ).resolves.toBeNull();
  });

  it('scopes the lookup to the user id', async () => {
    const query = mockRead([RECORD]);
    await expect(
      findMerchantByNormalizedName('mercadona', 'user-1'),
    ).resolves.toEqual(RECORD);
    expect(query).toHaveBeenCalledWith(expect.any(String), [
      'mercadona',
      'user-1',
    ]);
  });

  it('does not query at all for an empty normalized name', async () => {
    mockRead([RECORD]);
    await expect(
      findMerchantByNormalizedName('', 'user-1'),
    ).resolves.toBeNull();
    expect(withPoolMock).not.toHaveBeenCalled();
  });
});

describe('recordMerchantSeen', () => {
  it('normalises the raw name before upserting', async () => {
    const sql = mockWrite([RECORD]);
    await recordMerchantSeen(
      'user-1',
      'MERCADONA S.A. 1234',
      'Supermercado',
      'Tarjeta',
    );
    const [query] = sql.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const text = query.join('?');
    expect(text).toContain('INSERT INTO merchants');
    expect(text).toContain('ON CONFLICT (user_id, normalized_name)');
    const params = sql.mock.calls[0].slice(1) as unknown[];
    expect(params).toContain('user-1');
    expect(params).toContain('mercadona');
    expect(params).toContain('MERCADONA S.A. 1234');
  });

  it('rejects an unnormalisable merchant name instead of storing an empty key', async () => {
    mockWrite([RECORD]);
    await expect(
      recordMerchantSeen('user-1', '***', 'Supermercado', 'Tarjeta'),
    ).rejects.toThrow('Merchant name is required');
    expect(withClientMock).not.toHaveBeenCalled();
  });
});

describe('applyMerchantConfirmation', () => {
  // Review Focus #5: the SQL itself must overwrite the stored tipo and count
  // the correction, atomically, in one statement.
  it('increments veces_corregido and overwrites tipo when the value differs', async () => {
    const sql = mockWrite([]);
    await applyMerchantConfirmation({
      userId: 'user-1',
      comercio: 'Mercadona',
      tipo: 'Supermercado',
      plataforma_pago: 'Tarjeta',
    });
    const [query] = sql.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const text = query.join('?').replace(/\s+/g, ' ');
    expect(text).toContain('THEN merchants.veces_corregido + 1');
    expect(text).toContain('ELSE merchants.veces_confirmado + 1');
    expect(text).toContain('tipo = EXCLUDED.tipo');
    expect(text).toContain('plataforma_pago = EXCLUDED.plataforma_pago');
  });

  it('counts only a category change as a correction, never the payment method', async () => {
    // Paying the same merchant by card one week and Bizum the next is not a
    // correction; the CASE must compare tipo alone.
    const sql = mockWrite([]);
    await applyMerchantConfirmation({
      userId: 'user-1',
      comercio: 'Mercadona',
      tipo: 'Supermercado',
      plataforma_pago: 'Bizum',
    });
    const [query] = sql.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const text = query.join('?').replace(/\s+/g, ' ');
    expect(text).toContain('merchants.tipo IS DISTINCT FROM EXCLUDED.tipo');
    expect(text).not.toContain('plataforma_pago IS DISTINCT');
  });

  it('does not count the confirmation itself as a new sighting', async () => {
    // recordMerchantSeen already counted this receipt at parse time; if the
    // confirm bumped veces_visto again, one receipt would read as two.
    const sql = mockWrite([]);
    await applyMerchantConfirmation({
      userId: 'user-1',
      comercio: 'Mercadona',
      tipo: 'Supermercado',
      plataforma_pago: 'Tarjeta',
    });
    const [query] = sql.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(query.join('?').replace(/\s+/g, ' ')).not.toContain(
      'veces_visto = merchants.veces_visto + 1',
    );
  });

  it('rejects an unnormalisable merchant name', async () => {
    mockWrite([]);
    await expect(
      applyMerchantConfirmation({
        userId: 'user-1',
        comercio: '',
        tipo: 'Supermercado',
        plataforma_pago: 'Tarjeta',
      }),
    ).rejects.toThrow('Merchant name is required');
    expect(withClientMock).not.toHaveBeenCalled();
  });
});

describe('listMerchants and deleteMerchantById', () => {
  it('lists newest sightings first, scoped to the user', async () => {
    const query = mockRead([RECORD]);
    await expect(listMerchants('user-1')).resolves.toEqual([RECORD]);
    const [text, params] = query.mock.calls[0] as [string, string[]];
    expect(text).toContain('ORDER BY veces_visto DESC');
    expect(params).toEqual(['user-1']);
  });

  it('deletes by id and user id together', async () => {
    const sql = mockWrite([]);
    await deleteMerchantById('m-1', 'user-1');
    const [query, ...params] = sql.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    expect(query.join('?')).toContain('DELETE FROM merchants');
    expect(query.join('?')).toContain('AND user_id =');
    expect(params).toEqual(['m-1', 'user-1']);
  });
});
