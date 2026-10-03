import { ChartLoading, EmptyState, Section } from '@/components/analytics/kit';
import { RECORD_COLUMNS, RecordRow } from '@/components/analytics/record-rows';
import { type TopTransactionDatum } from '@/lib/analytics-charts';
import { cn } from '@/lib/utils';

interface TopTransactionsTableProps {
  transactions: TopTransactionDatum[];
  loading: boolean;
}

export function TopTransactionsTable({
  transactions,
  loading,
}: TopTransactionsTableProps) {
  return (
    <Section title="Mayores movimientos">
      {loading ? (
        <ChartLoading className="h-64" />
      ) : transactions.length > 0 ? (
        <>
          <div
            aria-hidden
            className={cn(
              'hidden border-b border-hairline pb-2 text-[11px] font-medium uppercase tracking-wide text-faint',
              RECORD_COLUMNS,
            )}
          >
            <span className="pl-[52px]">Categoría</span>
            <span>Acción</span>
            <span>Plataforma</span>
            <span>Fecha</span>
            <span className="text-right">Importe</span>
          </div>
          <ul aria-label="Mayores movimientos">
            {transactions.map((tx, i) => (
              <RecordRow
                key={tx.id}
                first={i === 0}
                name={tx.category}
                sub={[tx.tipo, tx.platform].filter(Boolean).join(' · ')}
                detail={tx.detalle1 ?? tx.detalle2}
                action={tx.action}
                platform={tx.platform}
                date={tx.fecha}
                amount={tx.amount}
              />
            ))}
          </ul>
        </>
      ) : (
        <EmptyState>No hay transacciones disponibles</EmptyState>
      )}
    </Section>
  );
}
