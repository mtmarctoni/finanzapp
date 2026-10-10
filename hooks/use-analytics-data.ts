import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';

import {
  type CategoryDatum,
  type TemporalDatum,
  type PlatformDatum,
  type TypeDatum,
  type TopTransactionDatum,
  type CategoryPlatformDatum,
  type TipoQueDatum,
  type CategoryTemporalDatum,
  type TypeTemporalDatum,
  type CategoryStatDatum,
} from '@/lib/analytics-charts';

interface AnalyticsMetrics {
  groupBy?: 'month' | 'year';
  [key: string]: unknown;
}

export interface AnalyticsData {
  temporalData: TemporalDatum[];
  categoryData: CategoryDatum[];
  platformData: PlatformDatum[];
  typeData: TypeDatum[];
  topTransactions: TopTransactionDatum[];
  categoryPlatformData: CategoryPlatformDatum[];
  tipoQueData: TipoQueDatum[];
  categoryTemporalData: CategoryTemporalDatum[];
  typeTemporalData: TypeTemporalDatum[];
  categoryStats: CategoryStatDatum[];
  availableYears: number[];
  sums: {
    gastos: number;
    ingresos: number;
    inversion: number;
  };
  metrics?: AnalyticsMetrics;
  netTemporal?: { period: string; net: number }[];
}

export interface Filters {
  search?: string;
  accion?: string;
  from?: Date;
  to?: Date;
  actions?: string[];
  categories?: string[];
  platforms?: string[];
  types?: string[];
  minAmount?: number;
  maxAmount?: number;
  groupBy?: 'month' | 'year';
  useActivePeriods?: boolean;
}

/** Delay before a changed search term triggers a request (one per pause, not per keystroke). */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Defensive normalization for multi-value filters.
 *
 * The analytics filter bar used to emit single strings for these fields
 * (see components/analytics-filter.tsx) while the fetch logic here iterated
 * them with `.forEach`. A string would throw a TypeError, the fetch would
 * fail, and the UI would silently keep showing stale data. Callers now emit
 * arrays, but a lone-old-read of this shape must never crash the request.
 */
function asArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function useAnalyticsData(options?: { ignoreTipoFromUrl?: boolean }) {
  const ignoreTipoFromUrl = options?.ignoreTipoFromUrl ?? false;
  const searchParams = useSearchParams();
  const [data, setData] = useState<AnalyticsData>({
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
    availableYears: [],
    sums: { gastos: 0, ingresos: 0, inversion: 0 },
    metrics: undefined,
    netTemporal: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialFilters = useCallback(() => {
    const search = searchParams.get('search') ?? '';
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty ?accion= param must still default to 'todos'
    const accion = searchParams.get('accion') || 'todos';
    const from = searchParams.get('from')
      ? new Date(searchParams.get('from') as string)
      : undefined;
    const to = searchParams.get('to')
      ? new Date(searchParams.get('to') as string)
      : undefined;
    const actions = searchParams.getAll('action');
    const categories = searchParams.getAll('category');
    const platforms = searchParams.getAll('platform');
    const types = ignoreTipoFromUrl ? [] : searchParams.getAll('type');
    const minAmount = searchParams.get('minAmount')
      ? Number(searchParams.get('minAmount'))
      : undefined;
    const maxAmount = searchParams.get('maxAmount')
      ? Number(searchParams.get('maxAmount'))
      : undefined;
    const groupBy: 'month' | 'year' =
      (searchParams.get('groupBy') ?? 'month') === 'year' ? 'year' : 'month';
    const useActivePeriods =
      (searchParams.get('useActivePeriods') ?? 'false') === 'true';
    return {
      search,
      accion,
      from,
      to,
      actions,
      categories,
      platforms,
      types,
      minAmount,
      maxAmount,
      groupBy,
      useActivePeriods,
    };
  }, [searchParams, ignoreTipoFromUrl]);

  const [filters, setFilters] = useState<Filters>(initialFilters);

  // Re-sync filters when the URL changes. Comparing during render (instead of
  // an effect) avoids setting an equal-but-new object on mount, which used to
  // fire a second /api/analytics request on every page load.
  const [syncedInitialFilters, setSyncedInitialFilters] = useState(
    () => initialFilters,
  );
  if (syncedInitialFilters !== initialFilters) {
    setSyncedInitialFilters(() => initialFilters);
    setFilters(initialFilters());
  }

  const lastSearch = useRef(filters.search);

  useEffect(() => {
    const controller = new AbortController();
    const searchChanged = filters.search !== lastSearch.current;

    const fetchData = async () => {
      lastSearch.current = filters.search;
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (filters.search) params.set('search', filters.search);
        if (filters.accion && filters.accion !== 'todos')
          params.set('action', filters.accion);
        asArray(filters.actions).forEach((a) => params.append('action', a));
        if (filters.from)
          params.set('from', filters.from.toISOString().split('T')[0]);
        if (filters.to)
          params.set('to', filters.to.toISOString().split('T')[0]);
        asArray(filters.categories).forEach((c) =>
          params.append('category', c),
        );
        asArray(filters.platforms).forEach((p) => params.append('platform', p));
        asArray(filters.types).forEach((t) => params.append('type', t));
        if (typeof filters.minAmount === 'number')
          params.set('minAmount', String(filters.minAmount));
        if (typeof filters.maxAmount === 'number')
          params.set('maxAmount', String(filters.maxAmount));
        params.set('groupBy', filters.groupBy ?? 'month');
        params.set(
          'useActivePeriods',
          String(filters.useActivePeriods ?? false),
        );
        const response = await fetch(`/api/analytics?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Error fetching analytics data');
        const result = await response.json();
        if (controller.signal.aborted) return;
        setData(result);
        setError(null);
      } catch (err) {
        // A superseded request must not overwrite the newer one's state.
        if (controller.signal.aborted) return;
        console.error('Error fetching analytics data:', err);
        setError('No se pudieron cargar los datos de análisis');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    // Typing in the search box debounces; every other filter change fetches
    // right away.
    const timer = setTimeout(
      () => void fetchData(),
      searchChanged ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters]);

  return { data, filters, setFilters, loading, error };
}
