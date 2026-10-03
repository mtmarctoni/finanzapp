'use client';

import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Plus,
  Repeat,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DashboardBodySkeleton } from '@/components/dashboard/dashboard-skeleton';
import { Money } from '@/components/dashboard/money';
import MonthlyTrendsChart from '@/components/monthly-trends-chart';
import { PageHeader } from '@/components/page-header';
import { CategoryTile } from '@/components/quick-add/category-icon';
import { useQuickAdd } from '@/components/quick-add/quick-add-context';
import { Button } from '@/components/ui/button';
import { getFinanceEntries } from '@/lib/data';
import { cn } from '@/lib/utils';

interface MonthlyTrend {
  month: string;
  income: number;
  expenses: number;
  investments: number;
}

interface Category {
  category: string;
  total: number;
  /** The item's most common category; null when it has none. */
  tipo?: string | null;
}

interface Breakdown {
  total: number;
  categories: Category[];
  averageMonthly: number;
  hasMore?: boolean;
}

interface DashboardStats {
  totalIncome: number;
  incomeCount: number;
  totalExpense: number;
  expenseCount: number;
  totalInvestment: number;
  investmentCount: number;
  balance: number;
  monthlyTrends: MonthlyTrend[];
  savingsRate: number;
  expenseBreakdown: Breakdown;
  incomeBreakdown: Breakdown;
}

interface RecentEntry {
  id: string;
  fecha: string;
  tipo: string;
  accion: string;
  que: string;
  plataforma_pago: string;
  cantidad: number | string;
}

const COLLAPSED_CATEGORIES = 5;
/** Rows shown on desktop before "Ver todo", to fill the right rail. */
const DESKTOP_CATEGORIES = 8;

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function percent(value: number) {
  return `${Math.round(value).toLocaleString('es-ES')} %`;
}

function relativeDay(fecha: string) {
  const date = parseISO(fecha);
  if (isToday(date)) return 'Hoy';
  if (isYesterday(date)) return 'Ayer';
  return format(date, 'd MMM', { locale: es }).replace('.', '');
}

/* ------------------------------------------------------------------------ */

function MonthSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const current = options.find((option) => option.value === value);
  // A transparent native <select> sits over a content-sized pill, so the pill
  // fits the chosen month instead of the longest option.
  return (
    <label className="relative inline-flex h-9 items-center gap-1 rounded-full border border-hairline bg-surface-2 pl-3.5 pr-2.5 text-[13px] font-medium text-foreground transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-surface-3">
      <span className="sr-only">Mes</span>
      <span aria-hidden>{current?.label}</span>
      <ChevronDown aria-hidden className="h-4 w-4 text-subtle" />
      <select
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex h-6 items-center justify-between gap-3">
      <h2 className="text-[17px] font-semibold tracking-[-0.02em]">{title}</h2>
      {action}
    </div>
  );
}

const linkAction =
  'inline-flex h-11 -my-2.5 items-center gap-0.5 rounded-lg px-1 -mr-1 text-[13px] font-medium text-subtle transition-colors hover:text-foreground';

function EmptyState({
  icon: Icon,
  text,
  onAdd,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[20px] border border-hairline bg-surface px-6 py-8 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-surface-3 text-subtle">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-[15px] text-subtle">{text}</p>
      <Button variant="secondary" size="sm" onClick={onAdd}>
        <Plus className="h-4 w-4" />
        Añadir registro
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function Hero({
  stats,
  monthName,
}: {
  stats: DashboardStats;
  monthName: string;
}) {
  const hasIncome = stats.totalIncome > 0;
  const isEmpty =
    stats.incomeCount + stats.expenseCount + stats.investmentCount === 0;

  let subline: React.ReactNode;
  if (isEmpty) subline = `Aún no hay registros en ${monthName}`;
  else if (!hasIncome) subline = `Sin ingresos registrados en ${monthName}`;
  else if (stats.savingsRate >= 0)
    subline = (
      <>
        Ahorras el{' '}
        <span className="num font-semibold text-foreground">
          {percent(stats.savingsRate)}
        </span>{' '}
        de tus ingresos
      </>
    );
  else
    subline = (
      <>
        Gastas un{' '}
        <span className="num font-semibold text-foreground">
          {percent(-stats.savingsRate)}
        </span>{' '}
        más de lo que ingresas
      </>
    );

  return (
    <section aria-labelledby="balance-label" className="pt-1">
      <p id="balance-label" className="text-[15px] text-subtle">
        Balance de <span className="text-foreground">{monthName}</span>
      </p>
      <p className="display-num mt-2 text-[64px] font-bold md:text-[52px]">
        <Money
          amount={stats.balance}
          tailClassName="text-[0.5em] font-semibold tracking-[-0.03em]"
        />
      </p>
      <p className="mt-2 text-[15px] text-subtle">{subline}</p>
    </section>
  );
}

type FlowKind = 'income' | 'expense' | 'investment';

/** Small tinted marker that says which flow an amount belongs to. */
function FlowIcon({ kind, className }: { kind: FlowKind; className?: string }) {
  const Icon =
    kind === 'income'
      ? ArrowDownLeft
      : kind === 'investment'
        ? TrendingUp
        : ArrowUpRight;
  return (
    <span
      aria-hidden
      className={cn(
        'grid h-5 w-5 shrink-0 place-items-center rounded-md',
        kind === 'income' && 'bg-positive/15 text-positive',
        kind === 'expense' && 'bg-negative/10 text-negative',
        kind === 'investment' && 'bg-invest/15 text-invest',
        className,
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
    </span>
  );
}

/**
 * Signed amount per the money rules: income "+" in positive, expenses "-" in
 * the foreground colour, investments unsigned in the foreground colour (the
 * invest icon next to them carries the meaning).
 */
function FlowAmount({
  kind,
  amount,
  className,
  tailClassName,
}: {
  kind: FlowKind;
  amount: number;
  className?: string;
  tailClassName?: string;
}) {
  const value = Math.abs(amount);
  return (
    <Money
      amount={kind === 'expense' ? -value : value}
      signed={kind === 'income' && value > 0}
      className={cn(
        kind === 'income' && value > 0 && 'text-positive',
        className,
      )}
      tailClassName={cn(
        kind === 'income' && value > 0 && 'text-positive/70',
        tailClassName,
      )}
    />
  );
}

function FlowSummary({ stats }: { stats: DashboardStats }) {
  const items: {
    kind: FlowKind;
    label: string;
    amount: number;
    count: number;
  }[] = [
    {
      kind: 'income',
      label: 'Ingresos',
      amount: stats.totalIncome,
      count: stats.incomeCount,
    },
    {
      kind: 'expense',
      label: 'Gastos',
      amount: stats.totalExpense,
      count: stats.expenseCount,
    },
  ];
  if (stats.totalInvestment > 0)
    items.push({
      kind: 'investment',
      label: 'Inversión',
      amount: stats.totalInvestment,
      count: stats.investmentCount,
    });
  return (
    <section
      aria-label="Resumen del mes"
      className={cn(
        'grid rounded-[20px] border border-hairline bg-surface py-3.5',
        items.length === 3 ? 'grid-cols-3' : 'grid-cols-2',
      )}
    >
      {items.map((item, index) => (
        <div
          key={item.kind}
          className={cn(
            'min-w-0 px-3.5 md:px-5',
            index > 0 && 'border-l border-hairline',
          )}
        >
          <div className="flex items-center gap-1.5">
            <FlowIcon kind={item.kind} />
            <span className="truncate text-[13px] font-medium text-subtle">
              {item.label}
            </span>
          </div>
          <p
            className={cn(
              'mt-2.5 truncate font-semibold leading-none tracking-[-0.03em]',
              items.length === 3 ? 'text-[16px] md:text-[20px]' : 'text-[20px]',
            )}
          >
            <FlowAmount
              kind={item.kind}
              amount={item.amount}
              tailClassName="text-[0.75em]"
            />
          </p>
          <p className="mt-1.5 text-[12px] text-faint">{item.count} mov.</p>
        </div>
      ))}
    </section>
  );
}

function CategoryRows({
  breakdown,
  expanded,
}: {
  breakdown: Breakdown;
  expanded: boolean;
}) {
  const rows = expanded
    ? breakdown.categories
    : breakdown.categories.slice(0, DESKTOP_CATEGORIES);
  return (
    <ul className="rounded-[20px] border border-hairline bg-surface px-4">
      {rows.map((row, index) => {
        const share =
          breakdown.total > 0
            ? Math.min(100, (row.total / breakdown.total) * 100)
            : 0;
        return (
          <li
            key={row.category}
            className={cn(
              'flex items-center gap-3 py-3',
              index > 0 && 'border-t border-hairline',
              !expanded && index >= COLLAPSED_CATEGORIES && 'hidden lg:flex',
            )}
          >
            <CategoryTile name={row.tipo ?? row.category} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[15px] font-semibold">
                  {row.category}
                </span>
                <span className="shrink-0 text-[15px] font-semibold">
                  <FlowAmount
                    kind="expense"
                    amount={row.total}
                    tailClassName="text-[13px]"
                  />
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[13px] text-subtle">
                  {row.tipo ?? 'Sin categoría'}
                </span>
                <span className="num shrink-0 text-[12px] text-faint">
                  {Math.round(share)} %
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-foreground/60"
                  style={{ width: `${Math.max(share, 1.5)}%` }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function RecordRow({ entry, first }: { entry: RecentEntry; first: boolean }) {
  const amount = Number(entry.cantidad);
  const kind: FlowKind =
    entry.accion === 'Ingreso'
      ? 'income'
      : entry.accion === 'Inversión'
        ? 'investment'
        : 'expense';
  return (
    <li
      className={cn(
        'flex h-16 items-center gap-3',
        !first && 'border-t border-hairline',
      )}
    >
      <CategoryTile name={entry.tipo || entry.que} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{entry.que}</p>
        <p className="truncate text-[13px] text-subtle">
          {[entry.tipo, entry.plataforma_pago].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="flex items-center justify-end gap-1.5 text-[15px] font-semibold">
          {kind === 'investment' && <FlowIcon kind="investment" />}
          <FlowAmount kind={kind} amount={amount} tailClassName="text-[13px]" />
        </p>
        <p className="text-[12px] text-faint">{relativeDay(entry.fecha)}</p>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------------ */

function RecurringLink({ className }: { className?: string }) {
  return (
    <Link
      href="/recurring"
      className={cn(
        'flex h-14 items-center gap-3 rounded-[20px] border border-hairline bg-surface px-4 transition-colors hover:bg-surface-2',
        className,
      )}
    >
      <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-surface-3 text-subtle">
        <Repeat className="h-4 w-4" />
      </span>
      <span className="flex-1 text-[15px] font-medium">
        Registros recurrentes
      </span>
      <ChevronRight className="h-4 w-4 text-faint" />
    </Link>
  );
}

export default function Dashboard() {
  const { data: session } = useSession();
  const quickAdd = useQuickAdd();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<RecentEntry[] | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() =>
    format(new Date(), 'yyyy-MM-01'),
  );
  const [expanded, setExpanded] = useState(false);
  const [fullBreakdown, setFullBreakdown] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const monthOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const sameYear = date.getFullYear() === now.getFullYear();
      return {
        value: format(date, 'yyyy-MM-01'),
        label: capitalize(
          format(date, sameYear ? 'MMMM' : 'MMMM yyyy', { locale: es }),
        ),
      };
    });
  }, []);

  const fetchStats = useCallback(
    // The full breakdown is small; fetch it up front so the desktop rail can
    // show more rows than mobile without a second request.
    async (showAll = true) => {
      const params = new URLSearchParams({
        month: selectedMonth,
        ...(showAll ? { showAll: 'true' } : {}),
      });
      const response = await fetch(`/api/summary?${params}`);
      if (!response.ok) throw new Error('Failed to fetch summary stats');
      const data = (await response.json()) as DashboardStats;
      setStats(data);
      setFullBreakdown(showAll);
    },
    [selectedMonth],
  );

  const fetchRecent = useCallback(async () => {
    const result = (await getFinanceEntries({
      page: 1,
      itemsPerPage: 5,
      sortBy: 'fecha',
      sortOrder: 'desc',
    })) as { data?: RecentEntry[] };
    setRecent(result.data ?? []);
  }, []);

  useEffect(() => {
    // Defer past the synchronous effect body (react-hooks/set-state-in-effect).
    void Promise.resolve().then(() => {
      setExpanded(false);
      fetchStats().catch((error: unknown) => {
        console.error('Error fetching stats:', error);
      });
    });
  }, [fetchStats]);

  useEffect(() => {
    void Promise.resolve().then(async () => fetchRecent());
  }, [fetchRecent]);

  // The quick-add sheet saves outside this tree; refresh once it closes.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !quickAdd.isOpen) {
      void Promise.resolve().then(() => {
        fetchStats(fullBreakdown).catch(() => undefined);
        fetchRecent();
      });
    }
    wasOpen.current = quickAdd.isOpen;
  }, [quickAdd.isOpen, fetchStats, fetchRecent, fullBreakdown]);

  const handleToggleCategories = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (!fullBreakdown && stats?.expenseBreakdown.hasMore) {
      setIsLoadingMore(true);
      try {
        await fetchStats(true);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoadingMore(false);
      }
    }
    setExpanded(true);
  };

  const firstName = session?.user.name?.trim().split(/\s+/)[0];
  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: es });
  const monthName = format(parseISO(selectedMonth), 'MMMM', { locale: es });

  const header = (
    <PageHeader
      eyebrow={<span suppressHydrationWarning>{today}</span>}
      title={firstName ? `Hola, ${firstName}` : 'Inicio'}
      actions={
        <MonthSelect
          value={selectedMonth}
          onChange={setSelectedMonth}
          options={monthOptions}
        />
      }
    />
  );

  if (!stats) {
    return (
      <>
        {header}
        <DashboardBodySkeleton />
      </>
    );
  }

  const breakdown = stats.expenseBreakdown;
  const canExpand =
    breakdown.hasMore === true ||
    breakdown.categories.length > COLLAPSED_CATEGORIES;
  // On desktop the rail already shows up to DESKTOP_CATEGORIES rows.
  const expandOnlyOnMobile =
    breakdown.hasMore !== true &&
    breakdown.categories.length <= DESKTOP_CATEGORIES;

  return (
    <>
      {header}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:grid-rows-[auto_1fr] lg:gap-x-10">
        <div className="space-y-4 lg:col-start-1 lg:row-start-1">
          <Hero stats={stats} monthName={monthName} />

          <FlowSummary stats={stats} />

          <section
            aria-label="Gasto mensual"
            className="rounded-[20px] border border-hairline bg-surface p-5"
          >
            <MonthlyTrendsChart
              monthlyTrends={stats.monthlyTrends}
              selectedMonth={selectedMonth}
            />
          </section>
        </div>

        <div className="space-y-8 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <section>
            <SectionHeader
              title="En qué gastas"
              action={
                canExpand && (
                  <button
                    type="button"
                    className={cn(
                      linkAction,
                      expandOnlyOnMobile && !expanded && 'lg:hidden',
                    )}
                    onClick={handleToggleCategories}
                    disabled={isLoadingMore}
                    aria-expanded={expanded}
                  >
                    {isLoadingMore
                      ? 'Cargando…'
                      : expanded
                        ? 'Ver menos'
                        : 'Ver todo'}
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 transition-transform',
                        expanded && 'rotate-180',
                      )}
                    />
                  </button>
                )
              }
            />
            {breakdown.categories.length > 0 ? (
              <CategoryRows breakdown={breakdown} expanded={expanded} />
            ) : (
              <EmptyState
                icon={ArrowUpRight}
                text={`Sin gastos en ${monthName}`}
                onAdd={quickAdd.open}
              />
            )}
          </section>

          <section>
            <SectionHeader
              title="Últimos registros"
              action={
                recent && recent.length > 0 ? (
                  <Link href="/records" className={linkAction}>
                    Ver todo
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : undefined
              }
            />
            {recent === null ? (
              <div className="h-[322px] animate-pulse rounded-[20px] border border-hairline bg-surface" />
            ) : recent.length > 0 ? (
              <ul className="rounded-[20px] border border-hairline bg-surface px-4">
                {recent.map((entry, index) => (
                  <RecordRow key={entry.id} entry={entry} first={index === 0} />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Plus}
                text="Todavía no has añadido ningún registro"
                onAdd={quickAdd.open}
              />
            )}
          </section>
        </div>

        <RecurringLink className="self-start lg:col-start-1 lg:row-start-2" />
      </div>
    </>
  );
}
