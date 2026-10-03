import { ChevronRight, Repeat } from 'lucide-react';

import { CategoryTile } from '@/components/quick-add/category-icon';
import { frequencyLabel } from '@/components/recurring/constants';
import {
  amountTone,
  formatNextDate,
  nextOccurrence,
  signedAmount,
} from '@/components/recurring/utils';
import { cn, formatCurrency } from '@/lib/utils';
import { type RecurringRecord } from '@/types/finance';

interface RecordsListProps {
  records: RecurringRecord[];
  selectedRecordId: string | null;
  /** Highlight the selected row (desktop, where the detail sits beside it). */
  showSelection: boolean;
  onSelectRecord: (id: string) => void;
}

function RecordRow({
  record,
  isSelected,
  onSelect,
}: {
  record: RecurringRecord;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const subtitle = [
    frequencyLabel[record.frequency],
    `día ${record.dia}`,
    record.plataforma_pago && record.plataforma_pago !== 'any'
      ? record.plataforma_pago
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={`Ver ${record.name}`}
      className={cn(
        'group -mx-2 flex h-16 w-[calc(100%+1rem)] items-center gap-3 rounded-[14px] px-2 text-left transition-colors hover:bg-surface-2/60',
        isSelected && 'bg-surface-2 hover:bg-surface-2',
      )}
    >
      <CategoryTile
        name={record.tipo || record.name}
        className={cn(!record.active && 'opacity-40 grayscale')}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-[15px] font-semibold tracking-[-0.01em]',
            !record.active && 'text-subtle',
          )}
        >
          {record.name}
        </span>
        <span className="block truncate text-[13px] text-subtle">
          {subtitle}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span
          className={cn(
            'num block text-[15px] font-semibold',
            record.active ? amountTone(record.accion) : 'text-faint',
          )}
        >
          {record.accion === 'Ingreso' ? '+' : ''}
          {formatCurrency(signedAmount(record))}
        </span>
        <span className="block text-[12px] text-faint">
          {record.active
            ? formatNextDate(nextOccurrence(record.dia))
            : 'Pausado'}
        </span>
      </span>
      <ChevronRight className="hidden h-4 w-4 shrink-0 text-faint lg:block" />
    </button>
  );
}

export function RecordsList({
  records,
  selectedRecordId,
  showSelection,
  onSelectRecord,
}: RecordsListProps) {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-[20px] border border-hairline bg-surface px-6 py-12 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-surface-3 text-subtle">
          <Repeat className="h-5 w-5" />
        </span>
        <p className="mt-4 text-[15px] font-semibold">Nada por aquí</p>
        <p className="mt-1 text-[13px] text-subtle">
          No hay recurrentes que coincidan con este filtro.
        </p>
      </div>
    );
  }

  return (
    <ul className="rounded-[20px] border border-hairline bg-surface px-4 py-1">
      {records.map((record, index) => (
        <li
          key={record.id}
          className={cn(index > 0 && 'border-t border-hairline')}
        >
          <RecordRow
            record={record}
            isSelected={showSelection && record.id === selectedRecordId}
            onSelect={() => onSelectRecord(record.id)}
          />
        </li>
      ))}
    </ul>
  );
}
