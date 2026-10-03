import { fireEvent, render, screen } from '@testing-library/react';

import {
  AnalyticsFilter,
  AnalyticsFilterChips,
  type AnalyticsFilterProps,
} from '@/components/analytics-filter';

/**
 * CRITICAL REGRESSION TESTS
 *
 * The analytics filter bar emits multi-value filters (`actions`,
 * `categories`, `platforms`, `types`) as arrays. The fetch logic in
 * `use-analytics-data` iterates these with `.forEach`, so a single string
 * value would crash the request while the UI silently keeps showing stale
 * data. These tests pin the array-emitting behavior.
 */

function renderFilter(props: Partial<AnalyticsFilterProps> = {}) {
  const propsWithDefaults: AnalyticsFilterProps = {
    value: {},
    onChange: jest.fn(),
    actions: ['Ingreso', 'Gasto', 'Inversión'],
    categories: ['Hipoteca', 'Comida'],
    platforms: ['Tarjeta', 'Transferencia', 'Efectivo'],
    types: ['Salario', 'Vivienda', 'Ocio'],
    years: [2026, 2025],
    ...props,
  };
  return render(<AnalyticsFilter {...propsWithDefaults} />);
}

// The fields live in a sheet behind the "Filtros" pill.
function openSelect(placeholderText: string) {
  if (!screen.queryByRole('dialog')) {
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
  }
  fireEvent.click(screen.getByText(placeholderText));
}

describe('AnalyticsFilter', () => {
  it('emits tipo as a one-element array', () => {
    const onChange = jest.fn();
    const value = { accion: 'todos' };
    renderFilter({ value, onChange });

    openSelect('Tipo (general)');
    fireEvent.click(screen.getByRole('option', { name: 'Vivienda' }));

    expect(onChange).toHaveBeenCalledWith({
      accion: 'todos',
      types: ['Vivienda'],
      categories: undefined,
    });
  });

  it('emits que as a one-element array', () => {
    const onChange = jest.fn();
    const value = { types: ['Vivienda'] };
    renderFilter({ value, onChange });

    openSelect('Categoría (específica)');
    fireEvent.click(screen.getByRole('option', { name: 'Hipoteca' }));

    expect(onChange).toHaveBeenCalledWith({
      types: ['Vivienda'],
      categories: ['Hipoteca'],
    });
  });

  it('emits action as a one-element array', () => {
    const onChange = jest.fn();
    renderFilter({ value: {}, onChange });

    openSelect('Acción');
    fireEvent.click(screen.getByRole('option', { name: 'Ingreso' }));

    expect(onChange).toHaveBeenCalledWith({ actions: ['Ingreso'] });
  });

  it('emits platform as a one-element array', () => {
    const onChange = jest.fn();
    renderFilter({ value: {}, onChange });

    openSelect('Plataforma');
    fireEvent.click(screen.getByRole('option', { name: 'Tarjeta' }));

    expect(onChange).toHaveBeenCalledWith({ platforms: ['Tarjeta'] });
  });

  it('resets que options when the que select has no selected tipo', () => {
    const onChange = jest.fn();
    renderFilter({
      value: { actions: ['Gasto'] },
      tipoToQueMap: new Map([['Vivienda', new Set(['Hipoteca'])]]),
      onChange,
    });

    // With no tipo selected the que select falls back to the general
    // categories list instead of the cascaded list.
    openSelect('Selecciona tipo primero');
    expect(
      screen.getByRole('option', { name: 'Hipoteca' }),
    ).toBeInTheDocument();
  });

  it('shows active filters as chips that clear only their own field', () => {
    const onChange = jest.fn();
    const value = { actions: ['Gasto'], platforms: ['Tarjeta'] };
    renderFilter({ value, onChange });
    render(<AnalyticsFilterChips value={value} onChange={onChange} />);

    expect(screen.getByRole('button', { name: /Filtros/ })).toHaveTextContent(
      '2',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Quitar filtro Tarjeta' }),
    );

    expect(onChange).toHaveBeenCalledWith({
      actions: ['Gasto'],
      platforms: [],
    });
  });
});
