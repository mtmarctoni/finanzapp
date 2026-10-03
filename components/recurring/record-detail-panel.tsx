import { MousePointerClick, Pencil, Trash2 } from 'lucide-react';

import { Money } from '@/components/dashboard/money';
import { CategoryTile } from '@/components/quick-add/category-icon';
import { frequencyLabel } from '@/components/recurring/constants';
import {
  amountTone,
  formatNextDate,
  nextOccurrence,
  signedAmount,
} from '@/components/recurring/utils';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type RecurringRecord } from '@/types/finance';

interface RecordDetailProps {
  record: RecurringRecord;
  loading: boolean;
  onEdit: (record: RecurringRecord) => void;
  onDelete: (id: string) => void;
  /** Rendered inside a sheet that supplies its own title element. */
  titleAs?: React.ElementType;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-t border-hairline py-2 first:border-t-0">
      <span className="text-[15px] text-subtle">{label}</span>
      <span className="min-w-0 truncate text-right text-[15px] font-medium">
        {value}
      </span>
    </div>
  );
}

/** Everything about one recurring record, plus edit and delete. */
export function RecordDetail({
  record,
  loading,
  onEdit,
  onDelete,
  titleAs: Title = 'h2',
}: RecordDetailProps) {
  const platform =
    record.plataforma_pago && record.plataforma_pago !== 'any'
      ? record.plataforma_pago
      : 'Cualquiera';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 pr-10">
        <CategoryTile name={record.tipo || record.name} size="lg" />
        <div className="min-w-0">
          <Title className="truncate text-[22px] font-semibold leading-tight tracking-[-0.03em]">
            {record.name}
          </Title>
          <p className="truncate text-[13px] text-subtle">
            {record.accion}
            {record.tipo ? ` · ${record.tipo}` : ''}
          </p>
        </div>
      </div>

      <div>
        <Money
          amount={signedAmount(record)}
          signed
          className={cn(
            'display-num text-[44px] font-semibold',
            amountTone(record.accion),
          )}
          tailClassName="text-[24px] font-medium text-faint"
        />
        <p className="mt-2 text-[13px] text-subtle">
          {frequencyLabel[record.frequency]}
          {record.active ? (
            <>
              {' · próximo '}
              <span className="text-foreground">
                {formatNextDate(nextOccurrence(record.dia))}
              </span>
            </>
          ) : (
            ' · pausado'
          )}
        </p>
      </div>

      <div className="rounded-[16px] bg-surface-2 px-4">
        <Row label="Día del mes" value={record.dia} />
        <Row label="Plataforma" value={platform} />
        <Row label="Quién" value={record.quien || 'Yo'} />
        <Row
          label="Estado"
          value={
            <span className="inline-flex items-center gap-2">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  record.active ? 'bg-positive' : 'bg-faint',
                )}
              />
              {record.active ? 'Activo' : 'Pausado'}
            </span>
          }
        />
        {record.detalle1 ? (
          <Row label="Detalle" value={record.detalle1} />
        ) : null}
        {record.detalle2 ? <Row label="Nota" value={record.detalle2} /> : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={() => onEdit(record)}
          disabled={loading}
        >
          <Pencil />
          Editar
        </Button>
        <Button
          variant="secondary"
          className="text-negative hover:text-negative"
          onClick={() => onDelete(record.id)}
          disabled={loading}
        >
          <Trash2 />
          Eliminar
        </Button>
      </div>
    </div>
  );
}

interface RecordDetailPanelProps {
  record: RecurringRecord | null;
  loading: boolean;
  onEdit: (record: RecurringRecord) => void;
  onDelete: (id: string) => void;
}

/** Desktop side panel that follows the selected row. */
export function RecordDetailPanel({
  record,
  loading,
  onEdit,
  onDelete,
}: RecordDetailPanelProps) {
  return (
    <aside className="h-fit rounded-[20px] border border-hairline bg-surface p-5 lg:sticky lg:top-8">
      {record ? (
        <RecordDetail
          record={record}
          loading={loading}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ) : (
        <div className="flex flex-col items-center py-10 text-center text-[13px] text-subtle">
          <MousePointerClick className="mb-3 h-5 w-5 text-faint" />
          Elige un recurrente para ver su detalle.
        </div>
      )}
    </aside>
  );
}
