import { TrendingUp } from 'lucide-react';

import { flowOf } from './record-format';

import { Money } from '@/components/dashboard/money';
import { cn } from '@/lib/utils';

/**
 * A record's amount with the app's sign rules: expenses "-" neutral, income
 * "+" positive, investments neutral behind a small invest-tinted trend icon,
 * so an unsigned figure never reads like income. Decimals and € are dimmed.
 */
export function RecordAmount({
  accion,
  amount,
  className,
  iconClassName,
  tailClassName,
}: {
  accion: string;
  amount: number;
  className?: string;
  iconClassName?: string;
  tailClassName?: string;
}) {
  const flow = flowOf(accion);
  const abs = Math.abs(amount);
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {flow === 'invest' && (
        <TrendingUp
          aria-label="Inversión"
          className={cn('h-3.5 w-3.5 shrink-0 text-invest', iconClassName)}
          strokeWidth={2.25}
        />
      )}
      <Money
        amount={flow === 'expense' ? -abs : abs}
        signed={flow === 'income'}
        className={flow === 'income' ? 'text-positive' : 'text-foreground'}
        tailClassName={cn(
          flow === 'income' ? 'text-positive/60' : 'text-subtle',
          tailClassName,
        )}
      />
    </span>
  );
}
