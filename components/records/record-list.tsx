'use client';

import { RecordAmount } from './record-amount';
import {
  amountOf,
  dayLabel,
  groupByDay,
  netText,
  shortDate,
  timeOf,
} from './record-format';

import { CategoryTile } from '@/components/quick-add/category-icon';
import type { Entry } from '@/types/finance';

function RecordRow({
  entry,
  meta,
  onOpen,
}: {
  entry: Entry;
  meta: string | null;
  onOpen: (entry: Entry) => void;
}) {
  const subtitle = [entry.tipo, entry.plataforma_pago]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className="border-t border-hairline first:border-t-0">
      <button
        type="button"
        onClick={() => onOpen(entry)}
        className="-mx-4 flex h-16 w-[calc(100%+2rem)] items-center gap-3 px-4 text-left transition-colors active:bg-surface-2"
      >
        <CategoryTile name={entry.tipo} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold leading-5 tracking-[-0.01em]">
            {entry.que}
          </span>
          <span className="mt-0.5 block truncate text-[13px] leading-[18px] text-subtle">
            {subtitle}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <RecordAmount
            accion={entry.accion}
            amount={amountOf(entry)}
            className="justify-end text-[15px] font-semibold leading-5"
          />
          {meta && (
            <span className="num mt-0.5 block text-[12px] leading-[18px] text-faint">
              {meta}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

/**
 * Mobile records list. Grouped by day when sorted by date; a flat list for
 * any other sort, where each row shows its own date instead of the time.
 */
export function RecordList({
  entries,
  grouped,
  onOpen,
}: {
  entries: Entry[];
  grouped: boolean;
  onOpen: (entry: Entry) => void;
}) {
  if (!grouped) {
    return (
      <ul className="rounded-[20px] border border-hairline bg-surface px-4">
        {entries.map((e) => (
          <RecordRow
            key={e.id}
            entry={e}
            meta={shortDate(e.fecha)}
            onOpen={onOpen}
          />
        ))}
      </ul>
    );
  }

  const now = new Date();
  return (
    <div className="space-y-6">
      {groupByDay(entries).map((group) => {
        const label = dayLabel(group.key, now);
        return (
          <section key={group.key} aria-label={label}>
            <div className="flex items-baseline justify-between px-1 pb-2">
              <h2 className="text-[13px] font-semibold text-subtle">{label}</h2>
              <span className="num text-[13px] text-faint">
                {netText(group.net)}
              </span>
            </div>
            <ul className="overflow-hidden rounded-[20px] border border-hairline bg-surface px-4">
              {group.entries.map((e) => (
                <RecordRow
                  key={e.id}
                  entry={e}
                  meta={timeOf(e.fecha)}
                  onOpen={onOpen}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
