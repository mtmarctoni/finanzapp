'use client';

import { endOfMonth, startOfMonth, subMonths } from 'date-fns';
import { CalendarDays, ChevronDown, SearchIcon, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SearchFilterProps {
  defaultValues?: {
    search?: string;
    accion?: string;
    fromDate?: Date;
    toDate?: Date;
  };
  onSearch?: (filters: {
    search: string;
    accion: string;
    from?: Date;
    to?: Date;
  }) => void;
  showActionFilter?: boolean;
  className?: string;
}

type Filters = {
  search: string;
  accion: string;
  fromDate?: Date;
  toDate?: Date;
};

const ACCIONES = [
  { value: 'todos', label: 'Todos' },
  { value: 'Gasto', label: 'Gastos' },
  { value: 'Ingreso', label: 'Ingresos' },
  { value: 'Inversión', label: 'Inversiones' },
];

const PRESETS = [
  { months: 1, label: 'Este mes' },
  { months: 3, label: '3 meses' },
  { months: 6, label: '6 meses' },
  { months: 12, label: '1 año' },
];

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

/** yyyy-mm-dd in local time (the URL format for from/to). */
function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Parse a yyyy-mm-dd URL value as a local calendar day. */
function fromYMD(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function presetRange(months: number) {
  const now = new Date();
  return {
    fromDate: startOfMonth(subMonths(now, months - 1)),
    toDate: endOfMonth(now),
  };
}

function sameDay(a?: Date, b?: Date) {
  return Boolean(a && b && toYMD(a) === toYMD(b));
}

function rangeLabel(from?: Date, to?: Date) {
  const fmt = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (from && to) return `${fmt(from)} – ${fmt(to)}`;
  if (from) return `Desde ${fmt(from)}`;
  if (to) return `Hasta ${fmt(to)}`;
  return 'Fechas';
}

function Chip({
  active,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[13px] font-semibold tracking-[-0.01em] transition-[background-color,color,border-color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-foreground text-background'
          : 'bg-surface-2 text-subtle hover:bg-surface-3 hover:text-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Records search + filters. A search field and a rail of chips that apply
 * immediately (type, period presets, custom dates in a sheet). Filters live
 * in the URL: search, accion, from, to, and page resets to 1 on every change.
 */
export function SearchFilter({
  defaultValues,
  onSearch,
  showActionFilter = true,
  className = '',
}: SearchFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<Filters>(() => ({
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty-string prop/URL values must fall through to the next source
    search: defaultValues?.search || searchParams.get('search') || '',
    accion:
      defaultValues?.accion ??
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty URL param must fall back to 'todos'
      (searchParams.get('accion') || 'todos'),
    fromDate: defaultValues?.fromDate ?? fromYMD(searchParams.get('from')),
    toDate: defaultValues?.toDate ?? fromYMD(searchParams.get('to')),
  }));
  const [datesOpen, setDatesOpen] = useState(false);
  const [draft, setDraft] = useState({ from: '', to: '' });

  const apply = (next: Filters) => {
    setFilters(next);
    const { search, accion, fromDate, toDate } = next;
    if (onSearch) {
      onSearch({ search, accion, from: fromDate, to: toDate });
      return;
    }
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (search) params.set('search', search);
    else params.delete('search');
    if (accion && accion !== 'todos') params.set('accion', accion);
    else params.delete('accion');
    if (fromDate) params.set('from', toYMD(fromDate));
    else params.delete('from');
    if (toDate) params.set('to', toYMD(toDate));
    else params.delete('to');
    // reset pagination when applying filters
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleReset = () => {
    setFilters({ search: '', accion: 'todos' });
    if (onSearch) {
      onSearch({ search: '', accion: 'todos' });
      return;
    }
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.delete('search');
    params.delete('accion');
    params.delete('from');
    params.delete('to');
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  const activePreset = PRESETS.find((p) => {
    const r = presetRange(p.months);
    return (
      sameDay(filters.fromDate, r.fromDate) && sameDay(filters.toDate, r.toDate)
    );
  });
  const customRange =
    !activePreset && Boolean(filters.fromDate ?? filters.toDate);
  const hasFilters =
    Boolean(filters.search) ||
    filters.accion !== 'todos' ||
    Boolean(filters.fromDate ?? filters.toDate);

  const openDates = () => {
    setDraft({
      from: filters.fromDate ? toYMD(filters.fromDate) : '',
      to: filters.toDate ? toYMD(filters.toDate) : '',
    });
    setDatesOpen(true);
  };

  const invalidRange = Boolean(draft.from && draft.to && draft.from > draft.to);

  // Sentinel just above the sticky bar: once it leaves the viewport the bar
  // is stuck and content is scrolling under it.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) =>
      setStuck(!entry.isIntersecting),
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="h-px md:hidden" />
      <div
        className={cn(
          // Sticky glass bar on mobile; the ::before paints the status-bar
          // safe area so rows never show through above it.
          // Same tone as the page at rest; the hairline only appears once
          // content scrolls under the bar.
          'glass sticky top-0 z-30 -mx-4 border-b bg-background/80 px-4 pb-3 pt-2 transition-[border-color] duration-200 before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-[env(safe-area-inset-top)] before:bg-background',
          stuck ? 'border-hairline' : 'border-transparent',
          'md:static md:mx-0 md:mb-2 md:border-0 md:bg-transparent md:px-0 md:pt-0 md:pb-4 md:backdrop-blur-none md:before:hidden',
          className,
        )}
      >
        <div className="flex flex-col gap-3">
          <form
            role="search"
            className="relative md:max-w-md"
            onSubmit={(e) => {
              e.preventDefault();
              apply(filters);
            }}
          >
            <button
              type="submit"
              aria-label="Aplicar filtros"
              className="absolute left-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-faint transition-colors hover:text-foreground"
            >
              <SearchIcon className="h-[18px] w-[18px]" />
            </button>
            <Input
              type="search"
              enterKeyHint="search"
              aria-label="Buscar registros"
              placeholder="Buscar por descripción o plataforma..."
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              className="h-11 pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden"
            />
            {filters.search && (
              <button
                type="button"
                aria-label="Borrar búsqueda"
                onClick={() => apply({ ...filters, search: '' })}
                className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-faint hover:text-foreground"
              >
                <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-surface-4 text-background">
                  <X className="h-3 w-3" strokeWidth={3} />
                </span>
              </button>
            )}
          </form>

          <div
            className="rail -mx-4 px-4 md:mx-0 md:min-w-0 md:flex-1 md:flex-wrap md:overflow-visible md:px-0 md:[mask-image:none] md:[-webkit-mask-image:none]"
            role="toolbar"
            aria-label="Filtros"
          >
            {showActionFilter && (
              <>
                {ACCIONES.map((a) => (
                  <Chip
                    key={a.value}
                    active={filters.accion === a.value}
                    onClick={() => apply({ ...filters, accion: a.value })}
                  >
                    {a.label}
                  </Chip>
                ))}
              </>
            )}
            {PRESETS.map((p) => (
              <Chip
                key={p.months}
                active={activePreset === p}
                onClick={() =>
                  apply(
                    activePreset === p
                      ? { ...filters, fromDate: undefined, toDate: undefined }
                      : { ...filters, ...presetRange(p.months) },
                  )
                }
              >
                {p.label}
              </Chip>
            ))}
            <Chip
              active={customRange}
              onClick={openDates}
              aria-haspopup="dialog"
            >
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              <span className="num">
                {customRange
                  ? rangeLabel(filters.fromDate, filters.toDate)
                  : 'Fechas'}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
            </Chip>
            {hasFilters && (
              <Chip onClick={handleReset} className="text-foreground">
                <X className="h-3.5 w-3.5" aria-hidden />
                Limpiar
              </Chip>
            )}
          </div>
        </div>

        <Dialog open={datesOpen} onOpenChange={setDatesOpen}>
          <DialogContent className="gap-0 sm:max-w-sm">
            <div
              aria-hidden
              className="mx-auto -mt-2 mb-4 h-1 w-9 rounded-full bg-surface-4 sm:hidden"
            />
            <DialogTitle className="text-[17px] font-semibold tracking-[-0.02em]">
              Rango de fechas
            </DialogTitle>
            <DialogDescription className="mt-1 text-[13px] text-subtle">
              Muestra solo los registros entre estas fechas.
            </DialogDescription>
            <form
              className="mt-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (invalidRange) return;
                setDatesOpen(false);
                apply({
                  ...filters,
                  fromDate: fromYMD(draft.from),
                  toDate: fromYMD(draft.to),
                });
              }}
            >
              <div className="rounded-[20px] border border-hairline bg-surface px-4">
                <label className="flex min-h-14 items-center justify-between gap-4">
                  <span className="text-[15px] text-subtle">Desde</span>
                  <input
                    type="date"
                    value={draft.from}
                    max={draft.to || undefined}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, from: e.target.value }))
                    }
                    className="num h-10 min-w-0 rounded-xl bg-surface-2 px-3 text-right text-[15px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-calendar-picker-indicator]:opacity-60 dark:[&::-webkit-calendar-picker-indicator]:invert"
                  />
                </label>
                <label className="flex min-h-14 items-center justify-between gap-4 border-t border-hairline">
                  <span className="text-[15px] text-subtle">Hasta</span>
                  <input
                    type="date"
                    value={draft.to}
                    min={draft.from || undefined}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, to: e.target.value }))
                    }
                    className="num h-10 min-w-0 rounded-xl bg-surface-2 px-3 text-right text-[15px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-calendar-picker-indicator]:opacity-60 dark:[&::-webkit-calendar-picker-indicator]:invert"
                  />
                </label>
              </div>
              {invalidRange && (
                <p role="alert" className="mt-2 px-1 text-[13px] text-negative">
                  La fecha de inicio debe ser anterior a la final.
                </p>
              )}
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setDraft({ from: '', to: '' })}
                >
                  Limpiar
                </Button>
                <Button type="submit" disabled={invalidRange}>
                  Aplicar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
