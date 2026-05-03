import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  CategoryDatum,
  TemporalDatum,
  PlatformDatum,
  TypeDatum,
  TopTransactionDatum,
  CategoryPlatformDatum,
  TipoQueDatum,
  CategoryTemporalDatum,
  CategoryStatDatum,
} from "@/lib/analytics-charts";

interface AnalyticsMetrics {
  groupBy?: "month" | "year";
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
  categoryStats: CategoryStatDatum[];
  sums: {
    gastos: number;
    ingresos: number;
    inversion: number;
  };
  metrics?: AnalyticsMetrics;
  netTemporal?: Array<{ period: string; net: number }>;
}

export interface Filters {
  search: string;
  accion: string;
  from?: Date;
  to?: Date;
  actions?: string[];
  categories?: string[];
  platforms?: string[];
  types?: string[];
  minAmount?: number;
  maxAmount?: number;
  groupBy?: "month" | "year";
  useActivePeriods?: boolean;
}

export function useAnalyticsData() {
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
    categoryStats: [],
    sums: { gastos: 0, ingresos: 0, inversion: 0 },
    metrics: undefined,
    netTemporal: [],
  });
  const [loading, setLoading] = useState(true);

  const initialFilters = useCallback(() => {
    const search = searchParams.get("search") || "";
    const accion = searchParams.get("accion") || "todos";
    const from = searchParams.get("from")
      ? new Date(searchParams.get("from") as string)
      : undefined;
    const to = searchParams.get("to")
      ? new Date(searchParams.get("to") as string)
      : undefined;
    const actions = searchParams.getAll("action");
    const categories = searchParams.getAll("category");
    const platforms = searchParams.getAll("platform");
    const types = searchParams.getAll("type");
    const minAmount = searchParams.get("minAmount")
      ? Number(searchParams.get("minAmount"))
      : undefined;
    const maxAmount = searchParams.get("maxAmount")
      ? Number(searchParams.get("maxAmount"))
      : undefined;
    const groupBy: "month" | "year" =
      (searchParams.get("groupBy") || "month") === "year" ? "year" : "month";
    const useActivePeriods =
      (searchParams.get("useActivePeriods") || "false") === "true";
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
  }, [searchParams]);

  const [filters, setFilters] = useState<Filters>(initialFilters());

  useEffect(() => {
    setFilters(initialFilters());
  }, [initialFilters]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.accion && filters.accion !== "todos")
        params.set("action", filters.accion);
      (Array.isArray(filters.actions)
        ? filters.actions
        : filters.actions
          ? [filters.actions]
          : []
      ).forEach((a) => params.append("action", a));
      if (filters.from)
        params.set("from", filters.from.toISOString().split("T")[0]);
      if (filters.to) params.set("to", filters.to.toISOString().split("T")[0]);
      (Array.isArray(filters.categories)
        ? filters.categories
        : filters.categories
          ? [filters.categories]
          : []
      ).forEach((c) => params.append("category", c));
      (Array.isArray(filters.platforms)
        ? filters.platforms
        : filters.platforms
          ? [filters.platforms]
          : []
      ).forEach((p) => params.append("platform", p));
      (Array.isArray(filters.types)
        ? filters.types
        : filters.types
          ? [filters.types]
          : []
      ).forEach((t) => params.append("type", t));
      if (typeof filters.minAmount === "number")
        params.set("minAmount", String(filters.minAmount));
      if (typeof filters.maxAmount === "number")
        params.set("maxAmount", String(filters.maxAmount));
      params.set("groupBy", filters.groupBy || "month");
      params.set("useActivePeriods", String(filters.useActivePeriods || false));
      const response = await fetch(`/api/analytics?${params.toString()}`);
      if (!response.ok) throw new Error("Error fetching analytics data");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching analytics data:", error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, filters, setFilters, loading };
}
