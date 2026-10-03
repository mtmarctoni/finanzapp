import { type RecurringRecord } from '@/types/finance';

/** How many times a frequency fires in an average month. */
const PER_MONTH: Record<RecurringRecord['frequency'], number> = {
  monthly: 1,
  weekly: 52 / 12,
  biweekly: 26 / 12,
  yearly: 1 / 12,
};

/**
 * Postgres numerics arrive as strings, so every amount goes through Number()
 * before any arithmetic (otherwise the sum concatenates into NaN).
 */
const recordAmount = (record: RecurringRecord): number => {
  const value = Number(record.amount);
  return Number.isFinite(value) ? value : 0;
};

const monthlyAmount = (record: RecurringRecord): number =>
  recordAmount(record) * PER_MONTH[record.frequency];

const getSignedRecurringAmount = (record: RecurringRecord): number =>
  record.accion === 'Ingreso' ? monthlyAmount(record) : -monthlyAmount(record);

export const calculateMonthlyEstimate = (records: RecurringRecord[]): number =>
  records
    .filter((record) => record.active)
    .reduce((sum, record) => sum + getSignedRecurringAmount(record), 0);

/** Monthly money that leaves the account: expenses plus investments. */
export const calculateMonthlyCommitted = (records: RecurringRecord[]): number =>
  records
    .filter((record) => record.active && record.accion !== 'Ingreso')
    .reduce((sum, record) => sum + monthlyAmount(record), 0);

export const calculateMonthlyIncome = (records: RecurringRecord[]): number =>
  records
    .filter((record) => record.active && record.accion === 'Ingreso')
    .reduce((sum, record) => sum + monthlyAmount(record), 0);

/**
 * Next calendar date on which the record's day of the month falls, today
 * included. Days past the end of a short month land on its last day.
 */
export const nextOccurrence = (dia: number, from = new Date()): Date => {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const clamp = (year: number, month: number) =>
    new Date(
      year,
      month,
      Math.min(dia, new Date(year, month + 1, 0).getDate()),
    );
  const thisMonth = clamp(today.getFullYear(), today.getMonth());
  return thisMonth >= today
    ? thisMonth
    : clamp(today.getFullYear(), today.getMonth() + 1);
};

const shortDate = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
});

/** "Hoy", "Mañana" or "5 oct". */
export const formatNextDate = (date: Date, from = new Date()): string => {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  return shortDate.format(date).replace('.', '');
};

/** Amount as shown in lists: income +, everything else -. */
export const signedAmount = (record: RecurringRecord): number =>
  record.accion === 'Ingreso' ? recordAmount(record) : -recordAmount(record);

export const amountTone = (accion: RecurringRecord['accion']): string =>
  accion === 'Ingreso'
    ? 'text-positive'
    : accion === 'Inversión'
      ? 'text-invest'
      : 'text-foreground';
