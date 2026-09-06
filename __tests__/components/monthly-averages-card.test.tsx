import { render, screen } from '@testing-library/react';

import { MonthlyAveragesCard } from '@/components/analytics/MonthlyAveragesCard';
import { type MonthlyAveragesResult } from '@/lib/analytics-charts';

const result: MonthlyAveragesResult = {
  totalMonths: 31,
  overall: [
    { action: 'Gasto', total: 590, average: 590 / 31 },
    { action: 'Ingreso', total: 1000, average: 1000 / 31 },
  ],
  byYear: [
    {
      year: 2024,
      months: 10,
      stats: [
        { action: 'Gasto', total: 300, average: 30 },
        { action: 'Ingreso', total: 0, average: 0 },
      ],
    },
    {
      year: 2025,
      months: 12,
      stats: [
        { action: 'Gasto', total: 200, average: 200 / 12 },
        { action: 'Ingreso', total: 1000, average: 1000 / 12 },
      ],
    },
  ],
};

describe('MonthlyAveragesCard', () => {
  it('renders the whole-history averages with month count and scope', () => {
    render(
      <MonthlyAveragesCard result={result} scopeLabel="Vivienda · Alquiler" />,
    );

    expect(screen.getByText('Promedios Mensuales')).toBeVisible();
    expect(screen.getByText('Vivienda · Alquiler')).toBeVisible();
    expect(screen.getByText('Gasto · 31 meses')).toBeVisible();
    expect(screen.getByText(/19,03 €/)).toBeVisible();
    expect(screen.getByText('Ingreso · 31 meses')).toBeVisible();
    expect(screen.getByText(/32,26 €/)).toBeVisible();
  });

  it('renders one row per year with its elapsed months, newest first', () => {
    render(<MonthlyAveragesCard result={result} scopeLabel="Vivienda" />);

    const table = screen.getByRole('table');
    expect(table).toHaveAccessibleName(
      'Promedios mensuales por año en Vivienda',
    );
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3); // header + 2 years
    expect(withinRowText(rows[1])).toMatch(/^202512/);
    expect(withinRowText(rows[2])).toMatch(/^202410/);
  });

  it('shows the empty state when there is no data', () => {
    render(
      <MonthlyAveragesCard
        result={{ totalMonths: 0, overall: [], byYear: [] }}
        scopeLabel="Vivienda"
      />,
    );

    expect(screen.getByText('No hay datos disponibles')).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a spinner while loading', () => {
    render(
      <MonthlyAveragesCard result={result} scopeLabel="Vivienda" loading />,
    );

    expect(
      screen.queryByText('No hay datos disponibles'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('explains the calendar-month definition', () => {
    render(<MonthlyAveragesCard result={result} scopeLabel="Vivienda" />);

    expect(
      screen.getByText(
        /Promedio por mes de calendario entre el primer y el último movimiento; los meses sin movimientos cuentan como 0\./,
      ),
    ).toBeVisible();
  });
});

function withinRowText(row: HTMLElement): string {
  return String(row.textContent);
}
