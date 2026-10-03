/**
 * Per-device memory for the quick-add sheet: the last choices, and what each
 * "qué" was filed under the last time. Pure convenience, so every read and
 * write tolerates storage being unavailable (private mode, blocked cookies).
 */

const KEY = 'finanzapp.quickadd.v1';

type Remembered = {
  tipo: string;
  plataforma_pago: string;
};

export type QuickAddMemory = {
  accion?: string;
  plataforma_pago?: string;
  quien?: string;
  /** Most recent first, deduplicated. */
  recentTipos: string[];
  recentPlataformas: string[];
  /** Lower-cased `que` -> what it was saved as last time. */
  byQue: Record<string, Remembered>;
};

const EMPTY: QuickAddMemory = {
  recentTipos: [],
  recentPlataformas: [],
  byQue: {},
};

export function loadMemory(): QuickAddMemory {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<QuickAddMemory>;
    return {
      ...EMPTY,
      ...parsed,
      recentTipos: Array.isArray(parsed.recentTipos) ? parsed.recentTipos : [],
      recentPlataformas: Array.isArray(parsed.recentPlataformas)
        ? parsed.recentPlataformas
        : [],
      byQue:
        parsed.byQue && typeof parsed.byQue === 'object' ? parsed.byQue : {},
    };
  } catch {
    return EMPTY;
  }
}

function bump(list: string[], value: string, max = 8) {
  return [value, ...list.filter((v) => v !== value)].slice(0, max);
}

export function rememberSave(entry: {
  accion: string;
  tipo: string;
  que: string;
  plataforma_pago: string;
  quien: string;
}) {
  try {
    const prev = loadMemory();
    const byQue = {
      ...prev.byQue,
      [entry.que.trim().toLowerCase()]: {
        tipo: entry.tipo,
        plataforma_pago: entry.plataforma_pago,
      },
    };
    // Keep the map bounded; insertion order is preserved for string keys.
    const keys = Object.keys(byQue);
    for (const k of keys.slice(0, Math.max(0, keys.length - 200))) {
      delete byQue[k];
    }
    const next: QuickAddMemory = {
      accion: entry.accion,
      plataforma_pago: entry.plataforma_pago,
      quien: entry.quien,
      recentTipos: bump(prev.recentTipos, entry.tipo),
      recentPlataformas: bump(prev.recentPlataformas, entry.plataforma_pago),
      byQue,
    };
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: the sheet still works, it just forgets.
  }
}

/** Recent picks first, then the server's frequency order, without repeats. */
export function orderOptions(recent: string[], options: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of [...recent, ...options]) {
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}
