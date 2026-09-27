/** @jest-environment node */

import { withPool } from '@/lib/db';
import {
  findEntryByContentHash,
  findSimilarReceiptEntry,
  looksLikeSameReceipt,
  type ExistingEntrySummary,
  type ReceiptCandidate,
} from '@/lib/receipts/dedupe';

jest.mock('@/lib/db', () => ({ withPool: jest.fn() }));

const withPoolMock = withPool as jest.MockedFunction<typeof withPool>;

function mockRead(rows: unknown[]) {
  const query = jest.fn().mockResolvedValue({ rows, rowCount: rows.length });
  withPoolMock.mockImplementation(async (fn) => fn({ query } as never));
  return query;
}

const CANDIDATE: ReceiptCandidate = {
  fecha: '2026-09-26',
  hora: 12,
  minuto: 30,
  comercio: 'MERCADONA S.A. 1234',
  cantidad: 43.2,
  plataforma_pago: 'Visa',
};

function entry(
  overrides: Partial<ExistingEntrySummary> = {},
): ExistingEntrySummary {
  return {
    id: 'e-1',
    fecha: '2026-09-26',
    tipo: 'Supermercado',
    accion: 'Gasto',
    que: 'Mercadona',
    plataforma_pago: 'Visa',
    cantidad: 43.2,
    detalle1: 'Leche',
    detalle2: null,
    quien: 'Yo',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('looksLikeSameReceipt', () => {
  // Review Focus #2
  it('matches the same purchase', () => {
    expect(looksLikeSameReceipt(CANDIDATE, entry())).toBe(true);
  });

  it('matches when the merchant is spelled differently on the ticket', () => {
    expect(
      looksLikeSameReceipt(CANDIDATE, entry({ que: 'MERCADONA*DON' })),
    ).toBe(true);
  });

  it('matches across one day, to absorb the local/UTC date difference', () => {
    expect(
      looksLikeSameReceipt(CANDIDATE, entry({ fecha: '2026-09-27' })),
    ).toBe(true);
  });

  it('tolerates a one-cent rounding difference', () => {
    expect(
      looksLikeSameReceipt(
        { ...CANDIDATE, cantidad: 43.2 },
        entry({ cantidad: 43.21 }),
      ),
    ).toBe(true);
  });

  it('rejects a different amount at the same shop', () => {
    expect(looksLikeSameReceipt(CANDIDATE, entry({ cantidad: 18.55 }))).toBe(
      false,
    );
  });

  it('rejects the same amount at a different shop', () => {
    expect(looksLikeSameReceipt(CANDIDATE, entry({ que: 'Lidl' }))).toBe(false);
  });

  it('rejects the same shop and amount two days apart', () => {
    expect(
      looksLikeSameReceipt(CANDIDATE, entry({ fecha: '2026-09-28' })),
    ).toBe(false);
  });

  it('rejects a malformed candidate date instead of matching everything', () => {
    expect(
      looksLikeSameReceipt(
        { ...CANDIDATE, fecha: 'no-date' },
        entry({ fecha: 'also-not-a-date' }),
      ),
    ).toBe(false);
  });
});

describe('findEntryByContentHash', () => {
  it('returns null when nothing matches', async () => {
    mockRead([]);
    await expect(
      findEntryByContentHash('a'.repeat(64), 'user-1'),
    ).resolves.toBeNull();
  });

  it('scopes the lookup to the user and the hash', async () => {
    const query = mockRead([entry()]);
    const found = await findEntryByContentHash('a'.repeat(64), 'user-1');

    expect(found?.id).toBe('e-1');
    const [sql, params] = query.mock.calls[0] ?? [];
    expect(sql).toContain('user_id = $1');
    expect(sql).toContain('content_hash = $2');
    expect(params).toEqual(['user-1', 'a'.repeat(64)]);
  });

  // `pg` returns a timestamptz as a `Date`, so selecting the column raw would
  // put a Date in a field this module types as `YYYY-MM-DD`.
  it('formats the day in SQL instead of casting the row', () => {
    const query = mockRead([entry()]);
    void findEntryByContentHash('a'.repeat(64), 'user-1');
    const [sql] = query.mock.calls[0] ?? [];
    expect(sql).toContain("to_char(fecha AT TIME ZONE 'UTC', 'YYYY-MM-DD')");
  });
});

describe('findSimilarReceiptEntry', () => {
  it('returns null when the window holds nothing', async () => {
    mockRead([]);
    await expect(
      findSimilarReceiptEntry(CANDIDATE, 'user-1'),
    ).resolves.toBeNull();
  });

  it('returns the best-scoring match, not the first row', async () => {
    mockRead([
      entry({ id: 'e-weak', que: 'Lidl' }),
      entry({ id: 'e-strong', que: 'Mercadona S.A.' }),
      entry({ id: 'e-exact', que: 'Mercadona' }),
    ]);
    const found = await findSimilarReceiptEntry(CANDIDATE, 'user-1');
    expect(found?.entry.id).toBe('e-strong');
    expect(found?.score).toBeGreaterThan(0.5);
  });

  it('returns null when the rows in the window are all different purchases', async () => {
    mockRead([entry({ id: 'e-1', que: 'Lidl', cantidad: 12 })]);
    await expect(
      findSimilarReceiptEntry(CANDIDATE, 'user-1'),
    ).resolves.toBeNull();
  });

  it('asks only for the user own expenses around that date', async () => {
    const query = mockRead([]);
    await findSimilarReceiptEntry(CANDIDATE, 'user-1');
    const [sql, params] = query.mock.calls[0] ?? [];
    expect(sql).toContain('user_id = $1');
    expect(sql).toContain("accion = 'Gasto'");
    expect(sql).toContain("INTERVAL '1 day'");
    // Noon UTC anchors the window on the local calendar date.
    expect(params?.[1]).toBe('2026-09-26T12:00:00.000Z');
  });
});
