import {
  applyJoyntlandaSplit,
  applyTimezoneShift,
  autoCorrectFecha,
  buildEntryFecha,
} from '@/lib/entries/normalize';

describe('autoCorrectFecha', () => {
  it('leaves a recent date alone', () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(autoCorrectFecha(recent)).toBe(recent);
  });

  it('rewrites the year of a stale OCR date to the current year', () => {
    const result = autoCorrectFecha('2019-03-15T10:00:00.000Z');
    expect(new Date(result).getFullYear()).toBe(new Date().getFullYear());
  });

  it('returns unparseable input unchanged so zod can report it', () => {
    expect(autoCorrectFecha('not-a-date')).toBe('not-a-date');
  });
});

describe('applyTimezoneShift', () => {
  it('treats a Z-suffixed string as local wall-clock time', () => {
    const result = applyTimezoneShift('2026-04-26T16:47:00.000Z');
    expect(result).toBe(new Date('2026-04-26T16:47:00').toISOString());
  });

  it('preserves the wall-clock reading while re-expressing it as a UTC instant', () => {
    const result = applyTimezoneShift('2026-04-26T16:47:00.000Z');
    const local = new Date(result);
    expect(local.getFullYear()).toBe(2026);
    expect(local.getMonth()).toBe(3);
    expect(local.getDate()).toBe(26);
    expect(local.getHours()).toBe(16);
    expect(local.getMinutes()).toBe(47);
  });

  it('returns input unchanged when the components cannot be read', () => {
    expect(applyTimezoneShift('26/04/2026')).toBe('26/04/2026');
  });
});

describe('applyJoyntlandaSplit', () => {
  it('halves the amount for joyntlanda, case-insensitively', () => {
    expect(
      applyJoyntlandaSplit({ plataforma_pago: ' Joyntlanda ', cantidad: 10 }),
    ).toBe(5);
  });

  it('rounds the half to two decimals', () => {
    expect(
      applyJoyntlandaSplit({ plataforma_pago: 'joyntlanda', cantidad: 9.99 }),
    ).toBe(5);
  });

  it('leaves every other payment method untouched', () => {
    expect(
      applyJoyntlandaSplit({ plataforma_pago: 'Tarjeta', cantidad: 10 }),
    ).toBe(10);
  });
});

describe('buildEntryFecha', () => {
  it('combines a plain date and a local wall-clock time', () => {
    expect(buildEntryFecha('2026-03-15', 16, 47)).toBe(
      new Date('2026-03-15T16:47:00').toISOString(),
    );
  });

  it('zero-pads single-digit hours and minutes', () => {
    expect(buildEntryFecha('2026-03-15', 9, 5)).toBe(
      new Date('2026-03-15T09:05:00').toISOString(),
    );
  });

  it('keeps the calendar day the caller asked for, whatever the timezone', () => {
    const result = buildEntryFecha('2026-01-01', 0, 0);
    expect(new Date(result).getFullYear()).toBe(2026);
    expect(new Date(result).getMonth()).toBe(0);
    expect(new Date(result).getDate()).toBe(1);
  });

  it('rejects an unparseable date instead of returning an Invalid Date', () => {
    expect(() => buildEntryFecha('15/03/2026', 10, 0)).toThrow(
      'Invalid entry date',
    );
  });
});
