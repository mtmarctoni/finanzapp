import { format } from 'date-fns';
import { CalendarDays, Search, X } from 'lucide-react';

import { type FilterState, type SortState } from '@/components/recurring/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const FILTERS: { value: FilterState; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Pausados' },
];

const SORTS: { value: SortState; label: string }[] = [
  { value: 'day', label: 'Por día' },
  { value: 'amount', label: 'Por importe' },
  { value: 'name', label: 'Por nombre' },
];

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-colors',
        active
          ? 'bg-foreground text-background'
          : 'bg-surface-2 text-subtle hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

interface RecordsControlsProps {
  search: string;
  filter: FilterState;
  sortBy: SortState;
  resultsCount: number;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: FilterState) => void;
  onSortChange: (value: SortState) => void;
  onClearFilters: () => void;
}

export function RecordsControls({
  search,
  filter,
  sortBy,
  resultsCount,
  hasActiveFilters,
  onSearchChange,
  onFilterChange,
  onSortChange,
  onClearFilters,
}: RecordsControlsProps) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar recurrentes"
          aria-label="Buscar recurrentes"
          className="rounded-xl border-transparent pl-10"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Borrar búsqueda"
            className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-faint hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="rail -mx-4 px-4 md:mx-0 md:px-0 md:[-webkit-mask-image:none] md:[mask-image:none]">
        {FILTERS.map((item) => (
          <Pill
            key={item.value}
            active={filter === item.value}
            onClick={() => onFilterChange(item.value)}
          >
            {item.label}
          </Pill>
        ))}
        <span
          aria-hidden
          className="mx-1 my-2 w-px shrink-0 bg-hairline-strong"
        />
        {SORTS.map((item) => (
          <Pill
            key={item.value}
            active={sortBy === item.value}
            onClick={() => onSortChange(item.value)}
          >
            {item.label}
          </Pill>
        ))}
      </div>

      <div className="flex h-6 items-center justify-between px-1 text-[13px]">
        <span className="text-faint">
          {resultsCount} {resultsCount === 1 ? 'recurrente' : 'recurrentes'}
        </span>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="font-medium text-subtle hover:text-foreground"
          >
            Limpiar filtros
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface GenerateCardProps {
  loading: boolean;
  generateDate: Date;
  onGenerateDateChange: (date: Date) => void;
  onGenerateRecords: () => void;
}

/** Turns the active recurring records into real movements for a month. */
export function GenerateCard({
  loading,
  generateDate,
  onGenerateDateChange,
  onGenerateRecords,
}: GenerateCardProps) {
  return (
    <section className="rounded-[20px] border border-hairline bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-subtle">
          <CalendarDays className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
            Generar movimientos
          </h2>
          <p className="mt-0.5 text-[13px] text-subtle">
            Crea los registros del mes a partir de los recurrentes activos.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input
          type="date"
          aria-label="Fecha de generación"
          value={format(generateDate, 'yyyy-MM-dd')}
          onChange={(e) => {
            if (e.target.value) onGenerateDateChange(new Date(e.target.value));
          }}
          className="sm:w-48"
        />
        <Button
          variant="secondary"
          onClick={onGenerateRecords}
          disabled={loading}
          className="sm:flex-1"
        >
          Generar registros
        </Button>
      </div>
    </section>
  );
}
