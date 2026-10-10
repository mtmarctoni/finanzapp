import { act, renderHook, waitFor } from '@testing-library/react';

import {
  SEARCH_DEBOUNCE_MS,
  useAnalyticsData,
} from '@/hooks/use-analytics-data';

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

  it('fetches once on mount', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('accion=Gasto'));

    const { result } = renderHook(() => useAnalyticsData());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('debounces search keystrokes into a single request', async () => {
    jest.useFakeTimers();
    try {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());
      const { result } = renderHook(() => useAnalyticsData());
      await act(async () => {
        await jest.runOnlyPendingTimersAsync();
      });
      fetchMock.mockClear();

      for (const search of ['m', 'me', 'mer']) {
        act(() => {
          result.current.setFilters({ ...result.current.filters, search });
        });
        await act(async () => {
          await jest.advanceTimersByTimeAsync(50);
        });
      }
      expect(fetchMock).not.toHaveBeenCalled();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toContain('search=mer');
    } finally {
      jest.useRealTimers();
    }
  });

  it('aborts a superseded request so its late response is ignored', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    let resolveFirst: (value: unknown) => void = () => undefined;
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation(
      async (_url: string, init?: { signal?: AbortSignal }) => {
        if (init?.signal) signals.push(init.signal);
        if (signals.length === 1)
          return new Promise((resolve) => {
            resolveFirst = resolve;
          });
        return Promise.resolve({
          ok: true,
          json: async () =>
            Promise.resolve({ ...emptyData, availableYears: [2025] }),
        });
      },
    );

    const { result } = renderHook(() => useAnalyticsData());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.setFilters({ accion: 'Ingreso' });
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(signals[0].aborted).toBe(true);
    await waitFor(() =>
      expect(result.current.data.availableYears).toEqual([2025]),
    );

    await act(async () => {
      resolveFirst({
        ok: true,
        json: async () =>
          Promise.resolve({ ...emptyData, availableYears: [1999] }),
      });
      await Promise.resolve();
    });
    expect(result.current.data.availableYears).toEqual([2025]);
  });

  it('exposes an error when the request fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    fetchMock.mockResolvedValue({ ok: false, json: jest.fn() });

    const { result } = renderHook(() => useAnalyticsData());

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.loading).toBe(false);
  });
});
