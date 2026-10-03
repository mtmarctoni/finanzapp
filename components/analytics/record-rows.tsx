import { format, isSameYear } from 'date-fns';
import { es } from 'date-fns/locale';

import { ActionBadge, Amount } from '@/components/analytics/kit';
import { CategoryTile } from '@/components/quick-add/category-icon';
import { cn } from '@/lib/utils';

/**
 * Column template shared by the header and every row: on mobile a row is the
 * house record row (tile | what over where | amount over date); from md up
 * the same DOM lays out as table columns.
 */
export const RECORD_COLUMNS =
  'md:grid md:grid-cols-[minmax(0,1fr)_6.5rem_minmax(0,9rem)_5.5rem_8rem] md:items-center md:gap-4';

function shortDate(value: string | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, isSameYear(d, new Date()) ? 'd MMM' : 'd MMM yy', {
    locale: es,
  });
}

export function RecordRow({
  name,
  sub,
  detail,
  action,
  platform,
  date,
  amount,
  first,
}: {
  name: string;
  /** Mobile second line, e.g. "Vivienda · Tarjeta". */
  sub: string;
  /** Desktop second line (free text detail). */
  detail?: string | null;
  action: string;
  platform: string;
  date: string;
  amount: number;
  first?: boolean;
}) {
  const isIncome = action === 'Ingreso';
  const abs = Math.abs(Number(amount));
  return (
    <li
      className={cn(
        'flex h-16 items-center gap-3 md:h-14',
        RECORD_COLUMNS,
        !first && 'border-t border-hairline',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <CategoryTile name={name} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold tracking-[-0.01em]">
            {name}
          </p>
          <p className="truncate text-[13px] text-subtle md:hidden">{sub}</p>
          <p className="hidden truncate text-[13px] text-faint md:block">
            {detail ?? '—'}
          </p>
        </div>
      </div>
      <div className="hidden md:block">
        <ActionBadge action={action} />
      </div>
      <p className="hidden truncate text-[13px] text-subtle md:block">
        {platform}
      </p>
      <p className="num hidden text-[13px] text-subtle md:block">
        {shortDate(date)}
      </p>
      <div className="shrink-0 text-right">
        <p className="text-[15px] font-semibold">
          <Amount
            amount={abs}
            sign={isIncome ? '+' : '-'}
            className={cn(isIncome && 'text-positive')}
          />
        </p>
        <p className="num text-[12px] text-faint md:hidden">
          {shortDate(date)}
        </p>
      </div>
    </li>
  );
}
