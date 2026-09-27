/** @jest-environment node */

import { createClient } from '@vercel/postgres';

import { insertEntry, type EntryInput } from '@/lib/entries/repo';

jest.mock('@vercel/postgres');
jest.mock('uuid', () => ({ v4: () => 'entry-id' }));

const mockedCreateClient = createClient as jest.MockedFunction<
  typeof createClient
>;

const sql = jest.fn();
const connect = jest.fn();
const end = jest.fn();

const BASE: EntryInput = {
  fecha: '2026-09-20T12:00:00.000Z',
  tipo: 'Supermercado',
  accion: 'Gasto',
  que: 'Mercadona',
  plataforma_pago: 'Visa',
  cantidad: 43.2,
  detalle1: 'Leche',
  quien: 'Yo',
};

function lastCall(): [TemplateStringsArray, ...unknown[]] {
  const call = sql.mock.calls.at(-1) ?? [];
  return call as [TemplateStringsArray, ...unknown[]];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedCreateClient.mockReturnValue({
    connect,
    sql,
    query: jest.fn(),
    end,
  } as unknown as ReturnType<typeof createClient>);
  connect.mockResolvedValue(undefined);
  end.mockResolvedValue(undefined);
  sql.mockResolvedValue({ rows: [], rowCount: 1 });
});

describe('insertEntry provenance', () => {
  it('stores manual defaults when nothing is known about a receipt', async () => {
    await insertEntry(BASE, 'user-1');
    const [strings, ...values] = lastCall();
    expect(strings.join(' ')).toContain('origen');
    expect(values).toContain('manual');
    expect(values).toContain('user-1');
  });

  it('stores the receipt provenance when the form supplies it', async () => {
    await insertEntry(
      {
        ...BASE,
        merchant_id: 'm-1',
        content_hash: 'a'.repeat(64),
        origen: 'receipt',
        confianza: 0.92,
      },
      'user-1',
    );
    const [strings, ...values] = lastCall();
    const sqlText = strings.join(' ');
    expect(sqlText).toContain('merchant_id');
    expect(sqlText).toContain('content_hash');
    expect(sqlText).toContain('confianza');
    expect(values).toContain('m-1');
    expect(values).toContain('a'.repeat(64));
    expect(values).toContain('receipt');
    expect(values).toContain(0.92);
  });

  it('writes provenance as NULL rather than an empty string', async () => {
    await insertEntry({ ...BASE, content_hash: '', merchant_id: '' }, 'user-1');
    const [, ...values] = lastCall();
    expect(values).toContain(null);
    expect(values).not.toContain('');
  });
});
