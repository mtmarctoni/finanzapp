import { act, renderHook, waitFor } from '@testing-library/react';

import { useAnalyticsData } from '@/hooks/use-analytics-data';

const emptyData = {
  temporalData: [],
  categoryData: [],
  platformData: [],
  typeData: [],
  topTransactions: [],
  categoryPlatformData: [],
  tipoQueData: [],
  categoryTemporalData: [],
  typeTemporalData: [],
  categoryStats: [],
  availableYears: [2024, 2023],
  sums: { gastos: 0, ingresos: 0, inversion: 0 },
  metrics: undefined,
  netTemporal: [],
};

const mockUseSearchParams = jest.fn();
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockUseSearchParams(),
}));

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

describe('useAnalyticsData', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mockUseSearchParams.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(emptyData),
    });
  });

  it('appends multi-value filters as repeated query params', async () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams(
        'action=Ingreso&action=Gasto&type=Vivienda&category=Alquiler&platform=Tarjeta',
      ),
    );

    renderHook(() => useAnalyticsData());

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('action=Ingreso');
    expect(url).toContain('action=Gasto');
    expect(url).toContain('type=Vivienda');
    expect(url).toContain('category=Alquiler');
    expect(url).toContain('platform=Tarjeta');
    expect(url).toContain('groupBy=month');
    expect(url).toContain('useActivePeriods=false');
  });

  it('maps the single accion param to the action filter', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('accion=Gasto'));

    renderHook(() => useAnalyticsData());

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('action=Gasto');
  });

  it('does not crash when the filter shape is a legacy single string (asArray guard)', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams());

    const { result } = renderHook(() => useAnalyticsData());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    act(() => {
      result.current.setFilters({
        actions: 'Gasto' as unknown as string[],
        types: 'Vivienda' as unknown as string[],
      });
    });

    await waitFor(() => {
      const url = fetchMock.mock.calls[
        fetchMock.mock.calls.length - 1
      ][0] as string;
      expect(url).toContain('action=Gasto');
      expect(url).toContain('type=Vivienda');
    });
  });

  it('includes tipo params from the URL by default', async () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams('type=Salario&action=Ingreso'),
    );

    renderHook(() => useAnalyticsData());

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('type=Salario');
  });

  it('ignores tipo params from the URL when ignoreTipoFromUrl is set', async () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams('type=Salario&action=Ingreso'),
    );

    renderHook(() => useAnalyticsData({ ignoreTipoFromUrl: true }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).not.toContain('type=');
    expect(url).toContain('action=Ingreso');
  });
});
