'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getCryptoOptions } from '@/lib/crypto-data';
import { cn } from '@/lib/utils';

type Filters = {
  search: string;
  transactionType: string;
  cryptoSymbol: string;
  from: string;
  to: string;
};

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

export function CryptoSearchFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<Filters>({
    search: searchParams.get('search') ?? '',
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty URL param must fall back to 'all'
    transactionType: searchParams.get('transactionType') || 'all',
    cryptoSymbol: searchParams.get('cryptoSymbol') ?? '',
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
  });
  const [sheetOpen, setSheetOpen] = useState(false);

  const [cryptoSymbols, setCryptoSymbols] = useState<string[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<
    { value: string; label: string }[]
  >([]);

  useEffect(() => {
    const fetchOptions = async () => {
      const options = await getCryptoOptions();
      setCryptoSymbols(options.cryptoSymbols);
      const types = options.transactionTypes;
      setTransactionTypes(
        types.some((type) => type.value === 'genesis')
          ? types
          : [...types, { value: 'genesis', label: 'Génesis' }],
      );
    };
    fetchOptions();
  }, []);

  const applyFilters = (next: Filters = filters) => {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.search) params.set('search', next.search);
    if (next.transactionType && next.transactionType !== 'all')
      params.set('transactionType', next.transactionType);
    if (next.cryptoSymbol && next.cryptoSymbol !== 'all')
      params.set('cryptoSymbol', next.cryptoSymbol);
    if (next.from) params.set('from', next.from);
    if (next.to) params.set('to', next.to);
    params.set('page', '1');
    router.push(`/investment/crypto?${params.toString()}`);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      transactionType: 'all',
      cryptoSymbol: '',
      from: '',
      to: '',
    });
    setSheetOpen(false);
    router.push('/investment/crypto');
  };

  const advancedCount = [
    filters.cryptoSymbol && filters.cryptoSymbol !== 'all',
    filters.from,
    filters.to,
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <form
          role="search"
          className="relative flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input
            placeholder="Buscar en notas, wallets..."
            aria-label="Buscar transacciones"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="border-transparent pl-10"
          />
          {filters.search && (
            <button
              type="button"
              aria-label="Borrar búsqueda"
              onClick={() => applyFilters({ ...filters, search: '' })}
              className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-faint hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label="Más filtros"
          className={cn(
            'relative grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors',
            advancedCount > 0
              ? 'bg-foreground text-background'
              : 'bg-surface-2 text-subtle hover:text-foreground',
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {advancedCount > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-surface-4 px-1 text-[11px] font-semibold text-foreground">
              {advancedCount}
            </span>
          )}
        </button>
      </div>

      <div className="rail -mx-4 px-4 md:mx-0 md:px-0 md:[-webkit-mask-image:none] md:[mask-image:none] md:flex-wrap">
        <Pill
          active={filters.transactionType === 'all'}
          onClick={() => applyFilters({ ...filters, transactionType: 'all' })}
        >
          Todos
        </Pill>
        {transactionTypes.map((type) => (
          <Pill
            key={type.value}
            active={filters.transactionType === type.value}
            onClick={() =>
              applyFilters({ ...filters, transactionType: type.value })
            }
          >
            {type.label}
          </Pill>
        ))}
      </div>

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle className="text-[22px] font-semibold tracking-[-0.03em]">
            Filtros
          </DialogTitle>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <span className="block px-1 text-[13px] font-medium text-subtle">
                Cripto
              </span>
              <Select
                value={filters.cryptoSymbol || 'all'}
                onValueChange={(value) =>
                  setFilters({ ...filters, cryptoSymbol: value })
                }
              >
                <SelectTrigger aria-label="Cripto">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {cryptoSymbols.slice(0, 20).map((symbol) => (
                    <SelectItem key={symbol} value={symbol}>
                      {symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="space-y-1.5">
              <span className="block px-1 text-[13px] font-medium text-subtle">
                Desde
              </span>
              <Input
                type="date"
                value={filters.from}
                onChange={(e) =>
                  setFilters({ ...filters, from: e.target.value })
                }
              />
            </label>
            <label className="space-y-1.5">
              <span className="block px-1 text-[13px] font-medium text-subtle">
                Hasta
              </span>
              <Input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="secondary" onClick={clearFilters}>
              Limpiar
            </Button>
            <Button
              onClick={() => {
                setSheetOpen(false);
                applyFilters();
              }}
            >
              Aplicar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
