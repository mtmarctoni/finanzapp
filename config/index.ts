export const APP_NAME =
  process.env.NEXT_PUBLIC_APP_NAME ?? "Finanzas Personales";
export const ITEMS_PER_PAGE = 100;
export const DEFAULT_ACCION_FILTER = "todos";
export const DEFAULT_SORT_BY = "fecha" as const;
export const DEFAULT_SORT_ORDER = "desc" as const;
