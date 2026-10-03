import { cn } from '@/lib/utils';

// Same grouping as `formatCurrency`, so heroes and lists agree on "2.500".
const EUR = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  useGrouping: 'always',
});

/**
 * Splits an es-ES euro amount into its integer part and its tail (",95 €"),
 * so the tail can be set smaller and greyer than the figure itself.
 */
function splitMoney(amount: number, { signed = false } = {}) {
  const parts = EUR.formatToParts(Math.abs(amount));
  let whole = '';
  let decimals = '';
  let currency = '';
  for (const part of parts) {
    if (part.type === 'integer' || part.type === 'group') whole += part.value;
    else if (part.type === 'decimal' || part.type === 'fraction')
      decimals += part.value;
    else if (part.type === 'currency') currency = part.value;
  }
  const sign = amount < 0 ? '-' : signed && amount > 0 ? '+' : '';
  return { sign, whole, decimals, currency };
}

/** Amount with a large integer part and a quieter ",95 €" tail. */
export function Money({
  amount,
  signed,
  className,
  tailClassName,
}: {
  amount: number;
  signed?: boolean;
  className?: string;
  tailClassName?: string;
}) {
  const { sign, whole, decimals, currency } = splitMoney(amount, { signed });
  return (
    <span className={cn('num whitespace-nowrap', className)}>
      {sign}
      {whole}
      <span className={cn('text-subtle', tailClassName)}>
        {decimals}
        {/* Tight tracking eats a plain space; keep "€" visibly apart. */}
        <span className="ml-[0.2em]">{currency}</span>
      </span>
    </span>
  );
}
