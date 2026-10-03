'use client';

import { ChevronDown } from 'lucide-react';
import * as React from 'react';

import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/* ─── Formatting ─────────────────────────────────────────────────────────── */

const ONE_DECIMAL = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 1,
});
const NO_DECIMALS = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 0,
});

/** Axis-friendly amount: 950 -> "950", 1240 -> "1,2k", 2_500_000 -> "2,5M". */
export function fmtShort(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${ONE_DECIMAL.format(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}${ONE_DECIMAL.format(abs / 1_000)}k`;
  return `${sign}${NO_DECIMALS.format(abs)}`;
}

export function fmtPct(value: number, digits = 1): string {
  return `${new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)} %`;
}

/** Splits "1.234,56 €" into "1.234" and ",56 €" for the hero treatment. */
function splitEuro(amount: number) {
  const parts = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    useGrouping: 'always',
  }).formatToParts(Math.abs(amount));
  let whole = '';
  let tail = '';
  for (const p of parts) {
    if (!tail && (p.type === 'integer' || p.type === 'group')) whole += p.value;
    else tail += p.value;
  }
  return { whole, tail };
}

/** Large figure with a quieter ",56 €" tail. */
export function HeroAmount({
  amount,
  sign = '',
  className,
}: {
  amount: number;
  sign?: '' | '-' | '+';
  className?: string;
}) {
  const { whole, tail } = splitEuro(amount);
  return (
    <span
      className={cn(
        'display-num whitespace-nowrap text-[44px] font-semibold md:text-[56px]',
        className,
      )}
    >
      {sign}
      {whole}
      <span className="text-[0.5em] font-medium text-subtle">{tail}</span>
    </span>
  );
}

/* ─── Layout ─────────────────────────────────────────────────────────────── */

export function Section({
  title,
  description,
  action,
  legend,
  children,
  className,
  ...props
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  legend?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>) {
  return (
    <Card className={cn('min-w-0 p-4 md:p-5', className)} {...props}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold leading-snug tracking-[-0.02em]">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-[13px] text-subtle">{description}</p>
          )}
          {legend && <div className="mt-2">{legend}</div>}
        </div>
        {action && (
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            {action}
          </div>
        )}
      </div>
      {children}
    </Card>
  );
}

export function Legend({
  items,
}: {
  items: { label: string; color: string; dashed?: boolean }[];
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-subtle">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              'inline-block h-2 w-2 rounded-full',
              item.dashed && 'h-0 w-3 rounded-none border-t-2 border-dashed',
            )}
            style={
              item.dashed
                ? { borderColor: item.color }
                : { backgroundColor: item.color }
            }
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function ChartLoading({ className }: { className?: string }) {
  return <Skeleton className={cn('h-full w-full rounded-xl', className)} />;
}

export function EmptyState({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid min-h-32 place-items-center rounded-xl px-4 text-center text-[13px] text-subtle',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Euro amount in the dashboard's money style: the integer part at full
 * strength and a quieter ",95 €" tail. `sign` forces a leading "+"/"-";
 * by default only negatives get one.
 */
export function Amount({
  amount,
  sign,
  className,
}: {
  amount: number;
  sign?: '+' | '-' | '';
  className?: string;
}) {
  const { whole, tail } = splitEuro(amount);
  const prefix = sign ?? (amount < 0 ? '-' : '');
  return (
    <span className={cn('num whitespace-nowrap', className)}>
      {amount === 0 ? '' : prefix}
      {whole}
      <span className="text-subtle">{tail}</span>
    </span>
  );
}

export interface Figure {
  key: string;
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  /** Small tinted glyph before the label (e.g. investments). */
  icon?: React.ReactNode;
}

/**
 * Secondary figures as one compact card split by hairlines, instead of a
 * stack of identical stat cards.
 */
export function FigureGrid({
  items,
  className,
}: {
  items: Figure[];
  className?: string;
}) {
  return (
    <Card className={cn('grid grid-cols-2 overflow-hidden p-0', className)}>
      {items.map((item, i) => (
        <div
          key={item.key}
          data-metric={item.key}
          className={cn(
            'min-w-0 px-4 py-3.5',
            i % 2 === 1 && 'border-l border-hairline',
            i >= 2 && 'border-t border-hairline',
            i === items.length - 1 && i % 2 === 0 && 'col-span-2',
          )}
        >
          <p className="flex items-center gap-1.5 truncate text-[13px] text-subtle">
            {item.icon}
            {item.label}
          </p>
          <p className="mt-0.5 truncate text-[18px] font-semibold leading-tight tracking-[-0.02em]">
            {item.value}
          </p>
          {item.sub && (
            <div className="mt-0.5 space-y-0.5 text-[12px] text-faint">
              {item.sub}
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}

/* ─── Controls ───────────────────────────────────────────────────────────── */

export const pillClass = (active: boolean) =>
  cn(
    'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[13px] font-semibold transition-colors active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40',
    active
      ? 'bg-foreground text-background'
      : 'bg-surface-2 text-subtle hover:bg-surface-3 hover:text-foreground',
  );

export const Pill = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }
>(({ active = false, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-pressed={active}
    className={cn(pillClass(active), className)}
    {...props}
  />
));
Pill.displayName = 'Pill';

/** Compact select rendered as a pill, for in-card pickers. */
export function PillSelect({
  value,
  onValueChange,
  placeholder,
  options,
  disabled,
  allOption,
  ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  options: string[];
  disabled?: boolean;
  allOption?: { value: string; label: string };
  ariaLabel?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        aria-label={ariaLabel}
        className="h-10 w-auto min-w-0 max-w-[11rem] gap-1.5 rounded-full border-transparent bg-surface-2 px-4 text-[13px] font-semibold [&>svg]:shrink-0"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {allOption && (
          <SelectItem value={allOption.value}>{allOption.label}</SelectItem>
        )}
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ─── Ranked bars ────────────────────────────────────────────────────────── */

export interface RankedItem {
  key: string;
  label: string;
  value: number;
  /** Share of the list total, 0..100. */
  pct: number;
  count?: number;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  tone?: 'neutral' | 'positive' | 'invest';
}

/**
 * Ranked horizontal bars: the house replacement for donuts and categorical
 * bar charts. Bars are scaled to the largest row so the ranking reads at a
 * glance; the percentage underneath is the share of the whole list.
 */
export function RankedBars({
  items,
  ariaLabel,
  shareLabel = 'del total',
  limit,
  className,
}: {
  items: RankedItem[];
  ariaLabel: string;
  shareLabel?: string;
  limit?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const max = Math.max(...items.map((i) => i.value), 0);
  const visible =
    limit && !expanded && items.length > limit ? items.slice(0, limit) : items;
  return (
    <div className={className}>
      <ul aria-label={ariaLabel} className="space-y-0">
        {visible.map((item, index) => {
          const width = max > 0 ? Math.max((item.value / max) * 100, 1.5) : 0;
          return (
            <li
              key={item.key}
              className={cn(
                'flex items-center gap-3 py-3',
                index > 0 && 'border-t border-hairline',
              )}
            >
              {item.icon}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">
                      {item.label}
                    </span>
                    {item.badge}
                  </div>
                  <Amount
                    amount={item.value}
                    sign={item.tone === 'positive' ? '+' : ''}
                    className={cn(
                      'shrink-0 text-[15px] font-semibold',
                      item.tone === 'positive' && 'text-positive',
                    )}
                  />
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      item.tone === 'positive'
                        ? 'bg-positive'
                        : item.tone === 'invest'
                          ? 'bg-invest'
                          : index === 0
                            ? 'bg-foreground'
                            : 'bg-subtle',
                    )}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between gap-3 text-[12px] text-faint">
                  <span className="num">
                    {fmtPct(item.pct)} {shareLabel}
                  </span>
                  {item.count !== undefined && (
                    <span className="num">{item.count} mov.</span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {limit && items.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 flex h-11 w-full items-center justify-center gap-1 rounded-xl text-[13px] font-semibold text-subtle hover:text-foreground"
        >
          {expanded ? 'Ver menos' : `Ver las ${items.length}`}
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform',
              expanded && 'rotate-180',
            )}
          />
        </button>
      )}
    </div>
  );
}

/** Tiny action label used inside ranked rows and record rows. */
export function ActionBadge({ action }: { action: string }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-[8px] bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium',
        action === 'Ingreso'
          ? 'text-positive'
          : action === 'Inversión'
            ? 'text-invest'
            : 'text-subtle',
      )}
    >
      {action}
    </span>
  );
}

/** iOS-style segmented control for switching a card's view. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn('flex gap-1 rounded-full bg-surface-2 p-1', className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-9 min-w-0 flex-1 truncate rounded-full px-3 text-[13px] font-semibold transition-colors',
            value === o.value
              ? 'bg-foreground text-background'
              : 'text-subtle hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
