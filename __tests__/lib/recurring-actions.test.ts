/** @jest-environment node */

import { createClient } from '@vercel/postgres';

import {
  deleteRecurringRecord,
  generateFinanceEntries,
} from '@/lib/recurringActions';

jest.mock('@vercel/postgres');
jest.mock('@/lib/db', () => ({ withPool: jest.fn() }));

const mockedCreateClient = createClient as jest.MockedFunction<
  typeof createClient
>;

const sql = jest.fn();
const query = jest.fn();
const end = jest.fn();

function record(name: string, dia: number) {
  return {
    id: `r-${name}`,
    name,
    accion: 'Gasto',
    tipo: 'Vivienda',
    detalle1: '',
    detalle2: '',
    quien: '',
    amount: 10,
    frequency: 'monthly',
    active: true,
    dia,
    plataforma_pago: 'Transferencia',
    user_id: 'user-1',
  };
}

/** The `fecha` values passed to the INSERT, in row order. */
function insertedDates(): string[] {
  expect(query).toHaveBeenCalledTimes(1);
  const params = query.mock.calls[0][1] as unknown[];
  // Ten parameters per row; `fecha` is the first of each row.
  return params.filter((_, i) => i % 10 === 0) as string[];
}

/**
 * Run `fn` as if the server ran at a fixed UTC offset: Date's local-time
 * constructor (`new Date(year, month, day)`) resolves at that offset. Setting
 * `process.env.TZ` has no effect here because Jest sandboxes `process.env`.
 */
async function atUtcOffset<T>(offsetHours: number, fn: () => Promise<T>) {
  const RealDate = Date;
  class OffsetDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length >= 2) {
        const [y, m, d = 1, h = 0, min = 0, sec = 0, ms = 0] = args as number[];
        super(RealDate.UTC(y, m, d, h, min, sec, ms) - offsetHours * 3_600_000);
      } else if (args.length === 1) {
        super(args[0] as number | string | Date);
      } else {
        super();
      }
    }
  }
  globalThis.Date = OffsetDate as DateConstructor;
  try {
    return await fn();
  } finally {
    globalThis.Date = RealDate;
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedCreateClient.mockReturnValue({
    connect: jest.fn(),
    sql,
    query,
    end,
  } as unknown as ReturnType<typeof createClient>);
  query.mockResolvedValue({ rows: [], rowCount: 0 });
});

function givenRecords(
  active: ReturnType<typeof record>[],
  existing: string[] = [],
) {
  sql
    .mockResolvedValueOnce({ rows: active })
    .mockResolvedValueOnce({ rows: existing.map((que) => ({ que })) });
}

describe('generateFinanceEntries', () => {
  it.each([
    ['UTC', 0],
    ['Madrid', 2],
    ['New York', -4],
  ])(
    'dates each entry on the record day of the month (%s)',
    async (_zone, offset) => {
      givenRecords([record('Alquiler', 1), record('Luz', 15)]);

      await atUtcOffset(offset, async () =>
        generateFinanceEntries('user-1', '2026-10-01', 2026, 10),
      );

      expect(insertedDates()).toEqual(['2026-10-01', '2026-10-15']);
    },
  );

  it('rolls a day past the end of the month into the next month', async () => {
    givenRecords([record('Gym', 31)]);

    await atUtcOffset(0, async () =>
      generateFinanceEntries('user-1', '2026-09-01', 2026, 9),
    );

    expect(insertedDates()).toEqual(['2026-10-01']);
  });

  it('skips records that already have an entry with the same name on the date', async () => {
    givenRecords([record('Alquiler', 1), record('Luz', 1)], ['Alquiler']);

    const { generated } = await generateFinanceEntries(
      'user-1',
      '2026-10-01',
      2026,
      10,
    );

    expect(generated).toBe(1);
    const params = query.mock.calls[0][1] as unknown[];
    expect(params).toContain('Luz');
    expect(params).not.toContain('Alquiler');
  });

  it('inserts every entry in one statement and defaults quien to Yo', async () => {
    givenRecords([record('A', 1), record('B', 2), record('C', 3)]);

    const { generated } = await generateFinanceEntries(
      'user-1',
      '2026-10-01',
      2026,
      10,
    );

    expect(generated).toBe(3);
    expect(query).toHaveBeenCalledTimes(1);
    const params = query.mock.calls[0][1] as unknown[];
    expect(params).toHaveLength(30);
    expect(params.filter((p) => p === 'Yo')).toHaveLength(3);
    expect(params.filter((p) => p === 'user-1')).toHaveLength(3);
    expect(end).toHaveBeenCalled();
  });

  it('runs no INSERT when every record already exists', async () => {
    givenRecords([record('Alquiler', 1)], ['Alquiler']);

    const { generated } = await generateFinanceEntries(
      'user-1',
      '2026-10-01',
      2026,
      10,
    );

    expect(generated).toBe(0);
    expect(query).not.toHaveBeenCalled();
    expect(sql).toHaveBeenCalledTimes(2);
  });
});

describe('deleteRecurringRecord', () => {
  it('returns true when a row was deleted', async () => {
    sql.mockResolvedValueOnce({ rowCount: 1 });
    await expect(deleteRecurringRecord('r-1', 'user-1')).resolves.toBe(true);
  });

  it('returns false when no row matched', async () => {
    sql.mockResolvedValueOnce({ rowCount: 0 });
    await expect(deleteRecurringRecord('r-1', 'user-1')).resolves.toBe(false);
  });

  it('propagates database errors instead of reporting success', async () => {
    sql.mockRejectedValueOnce(new Error('connection reset'));
    await expect(deleteRecurringRecord('r-1', 'user-1')).rejects.toThrow(
      'connection reset',
    );
    expect(end).toHaveBeenCalled();
  });
});
