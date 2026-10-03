import { formatCurrency } from '@/lib/utils';
import type { Entry } from '@/types/finance';

const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** The API sends `cantidad` as a numeric string; normalise it once. */
export function amountOf(entry: Pick<Entry, 'cantidad'>): number {
  const n = Number(entry.cantidad);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Dates saved without a time come back as UTC midnight. Read those by their
 * UTC calendar day so they never slip a day in another timezone, and treat
 * them as "no time".
 */
function isDateOnly(d: Date) {
  return (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}

function calendarParts(fecha: string) {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  if (isDateOnly(d)) {
    return {
      y: d.getUTCFullYear(),
      m: d.getUTCMonth(),
      day: d.getUTCDate(),
      time: null as string | null,
    };
  }
  return {
    y: d.getFullYear(),
    m: d.getMonth(),
    day: d.getDate(),
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
}

/** Stable per-day key (yyyy-mm-dd) used to group rows. */
function dayKey(fecha: string): string {
  const p = calendarParts(fecha);
  if (!p) return 'sin-fecha';
  return `${p.y}-${String(p.m + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** "Hoy", "Ayer", "30 sep", or "30 sep 2025" outside the current year. */
export function dayLabel(key: string, now = new Date()): string {
  if (key === 'sin-fecha') return 'Sin fecha';
  const [y, m, d] = key.split('-').map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(y, m - 1, d);
  const diff = Math.round((today.getTime() - that.getTime()) / 86_400_000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  const base = `${d} ${MONTHS[m - 1]}`;
  return y === now.getFullYear() ? base : `${base} ${y}`;
}

/** "18:54", or null for date-only records. */
export function timeOf(fecha: string): string | null {
  return calendarParts(fecha)?.time ?? null;
}

/** "2 oct 2026", optionally with " · 18:54". */
export function shortDate(fecha: string, withTime = false): string {
  const p = calendarParts(fecha);
  if (!p) return '';
  const base = `${p.day} ${MONTHS[p.m]} ${p.y}`;
  return withTime && p.time ? `${base} · ${p.time}` : base;
}

/** Full date for the detail sheet: "jueves, 2 de octubre de 2026". */
export function longDate(fecha: string): string {
  const p = calendarParts(fecha);
  if (!p) return '';
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(p.y, p.m, p.day));
}

export type Flow = 'income' | 'expense' | 'invest';

export function flowOf(accion: string): Flow {
  if (accion === 'Ingreso') return 'income';
  if (accion.startsWith('Inversi')) return 'invest';
  return 'expense';
}

/** Day net: income minus expenses (investments are transfers, not spend). */
export function netText(net: number): string {
  if (net === 0) return formatCurrency(0);
  return `${net > 0 ? '+' : '-'}${formatCurrency(Math.abs(net))}`;
}

export function groupByDay(entries: Entry[]) {
  const groups: { key: string; entries: Entry[]; net: number }[] = [];
  const index = new Map<string, number>();
  for (const e of entries) {
    const key = dayKey(e.fecha);
    let i = index.get(key);
    if (i === undefined) {
      i = groups.length;
      index.set(key, i);
      groups.push({ key, entries: [], net: 0 });
    }
    const g = groups[i];
    g.entries.push(e);
    const flow = flowOf(e.accion);
    if (flow === 'income') g.net += amountOf(e);
    if (flow === 'expense') g.net -= amountOf(e);
  }
  return groups;
}
