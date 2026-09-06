import {
  computeMonthlyAverages,
  type AveragesDatum,
} from '@/lib/analytics-charts';

describe('computeMonthlyAverages', () => {
  it('returns zeroed result for empty data', () => {
    expect(computeMonthlyAverages([])).toEqual({
      totalMonths: 0,
      overall: [],
      byYear: [],
    });
  });

  it('averages a single month over one calendar month', () => {
    const data: AveragesDatum[] = [
      { period: '2025-03-01', action: 'Gasto', total: 900 },
    ];

    const result = computeMonthlyAverages(data);

    expect(result.totalMonths).toBe(1);
    expect(result.overall).toEqual([
      { action: 'Gasto', total: 900, average: 900 },
    ]);
    expect(result.byYear).toEqual([
      {
        year: 2025,
        months: 1,
        stats: [{ action: 'Gasto', total: 900, average: 900 }],
      },
    ]);
  });

  it('divides a full year by 12 even when an action only has movements in some months', () => {
    const data: AveragesDatum[] = [
      ...Array.from({ length: 12 }, (_, index) => ({
        period: `2024-${String(index + 1).padStart(2, '0')}-01`,
        action: 'Gasto',
        total: 100,
      })),
      { period: '2024-01-01', action: 'Ingreso', total: 500 },
      { period: '2024-06-01', action: 'Ingreso', total: 500 },
    ];

    const result = computeMonthlyAverages(data);

    expect(result.totalMonths).toBe(12);
    expect(result.overall[0]).toEqual({
      action: 'Gasto',
      total: 1200,
      average: 100,
    });
    expect(result.overall[1]).toEqual({
      action: 'Ingreso',
      total: 1000,
      average: 1000 / 12,
    });
    expect(result.byYear).toHaveLength(1);
    expect(result.byYear[0]?.months).toBe(12);
  });

  it('divides partial years by their elapsed calendar months and counts interior gaps', () => {
    // Movements only in Mar 2024, Jan 2025, Dec 2025 and Sep 2026, but the
    // calendar window spans Mar 2024 -> Sep 2026 = 10 + 12 + 9 = 31 months.
    const data: AveragesDatum[] = [
      { period: '2024-03-01', action: 'Gasto', total: 300 },
      { period: '2025-01-01', action: 'Gasto', total: 100 },
      { period: '2025-12-01', action: 'Gasto', total: 100 },
      { period: '2026-09-01', action: 'Gasto', total: 90 },
    ];

    const result = computeMonthlyAverages(data);

    expect(result.totalMonths).toBe(31);
    expect(result.overall[0]?.average).toBeCloseTo(590 / 31, 10);
    expect(result.byYear).toEqual([
      {
        year: 2024,
        months: 10,
        stats: [{ action: 'Gasto', total: 300, average: 30 }],
      },
      {
        year: 2025,
        months: 12,
        stats: [{ action: 'Gasto', total: 200, average: 200 / 12 }],
      },
      {
        year: 2026,
        months: 9,
        stats: [{ action: 'Gasto', total: 90, average: 10 }],
      },
    ]);
  });

  it('still lists a year without any movements with zero averages', () => {
    const data: AveragesDatum[] = [
      { period: '2024-05-01', action: 'Gasto', total: 120 },
      { period: '2026-02-01', action: 'Gasto', total: 240 },
    ];

    const result = computeMonthlyAverages(data);

    expect(result.totalMonths).toBe(22);
    expect(result.byYear).toHaveLength(3);
    const gapYear = result.byYear.find((y) => y.year === 2025);
    expect(gapYear).toEqual({
      year: 2025,
      months: 12,
      stats: [{ action: 'Gasto', total: 0, average: 0 }],
    });
  });

  it('uses absolute totals and sums duplicate period+action rows', () => {
    const data: AveragesDatum[] = [
      { period: '2024-01-01', action: 'Gasto', total: -100 },
      { period: '2024-01-01', action: 'Gasto', total: -50 },
      { period: '2024-02-01', action: 'Gasto', total: -150 },
    ];

    const result = computeMonthlyAverages(data);

    expect(result.overall[0]).toEqual({
      action: 'Gasto',
      total: 300,
      average: 150,
    });
  });

  it('orders actions Gasto, Inversión, Ingreso and appends unknown ones', () => {
    const data: AveragesDatum[] = [
      { period: '2024-01-01', action: 'Ingreso', total: 100 },
      { period: '2024-01-01', action: 'Inversión', total: 100 },
      { period: '2024-01-01', action: 'Gasto', total: 100 },
      { period: '2024-01-01', action: 'Extra', total: 100 },
    ];

    const result = computeMonthlyAverages(data);

    expect(result.overall.map((s) => s.action)).toEqual([
      'Gasto',
      'Inversión',
      'Ingreso',
      'Extra',
    ]);
  });

  it('ignores rows with unparseable periods', () => {
    const data: AveragesDatum[] = [
      { period: 'not-a-date', action: 'Gasto', total: 500 },
      { period: '2024-01-01', action: 'Gasto', total: 200 },
    ];

    const result = computeMonthlyAverages(data);

    expect(result.totalMonths).toBe(1);
    expect(result.overall[0]?.total).toBe(200);
  });
});
