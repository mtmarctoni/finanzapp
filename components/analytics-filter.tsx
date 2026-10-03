'use client';

import {
  endOfMonth,
  endOfYear,
  format,
  isSameDay,
  startOfMonth,
  startOfYear,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';

import { Pill, pillClass } from '@/components/analytics/kit';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface AnalyticsFilterValue {
  search?: string;
  accion?: string;
  actions?: string[];
  categories?: string[];
  platforms?: string[];
  types?: string[];
  minAmount?: number;
  maxAmount?: number;
  from?: Date;
  to?: Date;
  groupBy?: 'month' | 'year';
  useActivePeriods?: boolean;
}

export interface AnalyticsFilterProps {
  value: AnalyticsFilterValue;
  onChange: (filters: AnalyticsFilterValue) => void;
  actions: string[];
  categories: string[];
  platforms: (string | null | undefined)[];
  types: (string | null | undefined)[];
  years: number[];
  tipoToQueMap?: Map<string, Set<string>>;
}

const isString = (v: string | null | undefined): v is string =>
  v !== null && v !== undefined;

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <span className="block text-[13px] font-medium text-subtle">{label}</span>
      {children}
    </div>
  );
}

interface FilterChip {
  key: string;
  label: string;
  clear: AnalyticsFilterValue;
}

/** Active filters as chip descriptors (the period lives in the header). */
function getFilterChips(value: AnalyticsFilterValue): FilterChip[] {
  const selectedTipo = Array.isArray(value.types)
    ? value.types[0]
    : value.types;
  const chips: FilterChip[] = [];
  if (value.search)
    chips.push({
      key: 'search',
      label: `“${value.search}”`,
      clear: { search: '' },
    });
  if (value.actions?.[0])
    chips.push({
      key: 'action',
      label: value.actions[0],
      clear: { actions: [] },
    });
  if (selectedTipo)
    chips.push({
      key: 'type',
      label: selectedTipo,
      clear: { types: [], categories: [] },
    });
  if (value.categories?.[0])
    chips.push({
      key: 'category',
      label: value.categories[0],
      clear: { categories: [] },
    });
  if (value.platforms?.[0])
    chips.push({
      key: 'platform',
      label: value.platforms[0],
      clear: { platforms: [] },
    });
  if (typeof value.minAmount === 'number')
    chips.push({
      key: 'min',
      label: `Desde ${value.minAmount} €`,
      clear: { minAmount: undefined },
    });
  if (typeof value.maxAmount === 'number')
    chips.push({
      key: 'max',
      label: `Hasta ${value.maxAmount} €`,
      clear: { maxAmount: undefined },
    });
  if (value.groupBy === 'year')
    chips.push({ key: 'group', label: 'Por año', clear: { groupBy: 'month' } });
  if (value.useActivePeriods)
    chips.push({
      key: 'active',
      label: 'Solo periodos activos',
      clear: { useActivePeriods: false },
    });

  return chips;
}

/** Removable chips for the active filters; renders nothing when none. */
export function AnalyticsFilterChips({
  value,
  onChange,
}: {
  value: AnalyticsFilterValue;
  onChange: (filters: AnalyticsFilterValue) => void;
}) {
  const chips = getFilterChips(value);
  if (chips.length === 0) return null;
  return (
    <ul
      aria-label="Filtros activos"
      className="rail -mr-4 min-w-0 pr-4 md:mr-0 md:flex-wrap md:pr-0 md:[mask-image:none]"
      // Fade only the trailing edge: the first chip sits flush left.
      style={{
        maskImage:
          'linear-gradient(90deg, #000 calc(100% - 28px), transparent)',
        WebkitMaskImage:
          'linear-gradient(90deg, #000 calc(100% - 28px), transparent)',
      }}
    >
      {chips.map((chip) => (
        <li key={chip.key} className="shrink-0">
          <span className="inline-flex h-9 items-center gap-1 rounded-full bg-foreground pl-3.5 pr-1 text-[13px] font-semibold text-background">
            <span className="max-w-[10rem] truncate">{chip.label}</span>
            <button
              type="button"
              onClick={() => onChange({ ...value, ...chip.clear })}
              className="grid h-8 w-8 place-items-center rounded-full text-background/60 hover:text-background"
              aria-label={`Quitar filtro ${chip.label}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Filters for /analytics. Collapsed into a compact "Filtros" button that opens
 * a sheet; active filters show via AnalyticsFilterChips. Changes are
 * emitted immediately (multi-value fields always as arrays).
 */
export function AnalyticsFilter({
  value,
  onChange,
  actions,
  categories,
  platforms,
  types,
  tipoToQueMap,
}: AnalyticsFilterProps) {
  const [open, setOpen] = useState(false);

  // Determine available que options based on selected tipo
  const selectedTipo = Array.isArray(value.types)
    ? value.types[0]
    : value.types;
  const availableQue =
    selectedTipo && tipoToQueMap?.has(selectedTipo)
      ? Array.from(tipoToQueMap.get(selectedTipo) ?? []).sort()
      : categories;

  const handleTipoChange = (tipo: string) => {
    // Reset que when tipo changes
    onChange({ ...value, types: [tipo], categories: undefined });
  };

  const handleQueChange = (que: string) => {
    onChange({ ...value, categories: [que] });
  };

  const filterCount = getFilterChips(value).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          pillClass(false),
          'gap-1.5 px-3 text-foreground',
          filterCount > 0 && 'pr-2',
        )}
        aria-haspopup="dialog"
        aria-label={
          filterCount > 0 ? `Filtros (${filterCount} activos)` : 'Filtros'
        }
      >
        <SlidersHorizontal className="h-4 w-4" />
        <span className="hidden sm:inline">Filtros</span>
        {filterCount > 0 && (
          <span className="num grid h-6 min-w-6 place-items-center rounded-full bg-foreground px-1.5 text-[11px] font-semibold text-background">
            {filterCount}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-5 sm:max-w-md">
          <DialogHeader className="pr-10 text-left">
            <DialogTitle className="text-[22px] font-bold tracking-[-0.03em]">
              Filtros
            </DialogTitle>
            <DialogDescription className="text-[13px] text-subtle">
              Se aplican al momento a todo el análisis.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Field label="Buscar">
              <Input
                placeholder="Buscar..."
                value={value.search ?? ''}
                onChange={(e) => onChange({ ...value, search: e.target.value })}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Movimiento">
                <Select
                  value={value.actions?.[0] ?? ''}
                  onValueChange={(action) =>
                    onChange({ ...value, actions: [action] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Acción" />
                  </SelectTrigger>
                  <SelectContent>
                    {actions.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Método de pago">
                <Select
                  value={value.platforms?.[0] ?? ''}
                  onValueChange={(platform) =>
                    onChange({ ...value, platforms: [platform] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Plataforma" />
                  </SelectTrigger>
                  <SelectContent>
                    {platforms.filter(isString).map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Tipo (general) comes first */}
              <Field label="Tipo">
                <Select
                  value={selectedTipo ?? ''}
                  onValueChange={handleTipoChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo (general)" />
                  </SelectTrigger>
                  <SelectContent>
                    {types.filter(isString).map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {/* Que (specific) cascades from tipo */}
              <Field label="Categoría">
                <Select
                  value={value.categories?.[0] ?? ''}
                  onValueChange={handleQueChange}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        selectedTipo
                          ? 'Categoría (específica)'
                          : 'Selecciona tipo primero'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableQue.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Importe mínimo">
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="Mín. €"
                  value={value.minAmount ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      minAmount: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                />
              </Field>
              <Field label="Importe máximo">
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="Máx. €"
                  value={value.maxAmount ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      maxAmount: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                />
              </Field>
            </div>

            <Field label="Agrupar por">
              <div className="flex gap-2" role="group" aria-label="Agrupar por">
                <Pill
                  active={(value.groupBy ?? 'month') === 'month'}
                  onClick={() => onChange({ ...value, groupBy: 'month' })}
                >
                  Mes
                </Pill>
                <Pill
                  active={value.groupBy === 'year'}
                  onClick={() => onChange({ ...value, groupBy: 'year' })}
                >
                  Año
                </Pill>
              </div>
            </Field>

            <Field label="Promedios">
              <div className="flex flex-wrap gap-2" role="group">
                <Pill
                  active={!value.useActivePeriods}
                  onClick={() =>
                    onChange({ ...value, useActivePeriods: false })
                  }
                >
                  Todos los periodos
                </Pill>
                <Pill
                  active={Boolean(value.useActivePeriods)}
                  onClick={() => onChange({ ...value, useActivePeriods: true })}
                >
                  Solo periodos activos
                </Pill>
              </div>
            </Field>
          </div>

          <DialogFooter className="flex-row gap-2 sm:space-x-0">
            <Button
              variant="secondary"
              className="h-12 flex-1"
              onClick={() => onChange({})}
            >
              Limpiar
            </Button>
            <Button className="h-12 flex-1" onClick={() => setOpen(false)}>
              Ver resultados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─── Period control (page header action) ────────────────────────────────── */

const MONTH_PRESETS = [
  { months: 1, label: 'Este mes' },
  { months: 3, label: '3 meses' },
  { months: 6, label: '6 meses' },
  { months: 12, label: '12 meses' },
];

interface PeriodControlProps {
  value: AnalyticsFilterValue;
  onChange: (filters: AnalyticsFilterValue) => void;
  years: number[];
}

function sameRange(value: AnalyticsFilterValue, from: Date, to: Date): boolean {
  return Boolean(
    value.from &&
    value.to &&
    isSameDay(value.from, from) &&
    isSameDay(value.to, to),
  );
}

/** "6 meses" / "2025" / "Todo" / "1 ene – 30 sep" for the current range. */
export function AnalyticsPeriodControl({
  value,
  onChange,
  years,
}: PeriodControlProps) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const now = new Date();

  const presets = [
    ...MONTH_PRESETS.map((p) => ({
      key: `m${p.months}`,
      label: p.label,
      from: startOfMonth(subMonths(now, p.months - 1)),
      to: endOfMonth(now),
    })),
    {
      key: 'ytd',
      label: 'Este año',
      from: startOfYear(now),
      to: endOfMonth(now),
    },
  ];
  const yearPresets = years.map((y) => ({
    key: `y${y}`,
    label: String(y),
    from: startOfYear(new Date(y, 0, 1)),
    to: endOfYear(new Date(y, 0, 1)),
  }));

  const match = [...presets, ...yearPresets].find((p) =>
    sameRange(value, p.from, p.to),
  );
  const label =
    !value.from || !value.to
      ? 'Todo'
      : (match?.label ??
        `${format(value.from, 'd MMM', { locale: es })} – ${format(value.to, 'd MMM yy', { locale: es })}`);

  const apply = (from?: Date, to?: Date) => {
    onChange({ ...value, from, to });
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setCustom(false);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[13px] font-semibold"
          aria-label={`Periodo: ${label}`}
        >
          <CalendarDays className="h-4 w-4 text-subtle" />
          <span className="max-w-[9rem] truncate">{label}</span>
          <ChevronDown className="h-4 w-4 text-subtle" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn(
          'w-[min(20rem,calc(100vw-2rem))] p-3',
          custom && 'w-auto',
        )}
      >
        {custom ? (
          <Calendar
            mode="range"
            selected={
              value.from && value.to
                ? { from: value.from, to: value.to }
                : undefined
            }
            onSelect={(range) => {
              if (
                range &&
                typeof range === 'object' &&
                'from' in range &&
                'to' in range
              ) {
                onChange({
                  ...value,
                  from: range.from as Date,
                  to: range.to as Date,
                });
              }
            }}
            autoFocus
          />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-1.5">
              <Pill active={!value.from} onClick={() => apply()}>
                Todo
              </Pill>
              {presets.map((p) => (
                <Pill
                  key={p.key}
                  active={match?.key === p.key}
                  onClick={() => apply(p.from, p.to)}
                >
                  {p.label}
                </Pill>
              ))}
            </div>
            {yearPresets.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-t border-hairline pt-3">
                {yearPresets.map((p) => (
                  <Pill
                    key={p.key}
                    active={match?.key === p.key}
                    onClick={() => apply(p.from, p.to)}
                    className="flex-1"
                  >
                    {p.label}
                  </Pill>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setCustom(true)}
              className="flex h-11 w-full items-center justify-center rounded-xl text-[13px] font-semibold text-subtle hover:bg-surface-2 hover:text-foreground"
            >
              Rango personalizado
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
