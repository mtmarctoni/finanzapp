'use client';

import { useCallback, useEffect, useState } from 'react';

import { CategoryTile } from '@/components/quick-add/category-icon';
import {
  SettingsGroup,
  SettingsRow,
} from '@/components/settings/settings-group';

/** Spanish needs the noun to agree with the count: "1 compra", "2 compras". */
function plural(count: number, singular: string, many: string): string {
  return `${count} ${count === 1 ? singular : many}`;
}

interface MerchantSummary {
  id: string;
  canonical_name: string;
  tipo: string | null;
  veces_visto: number;
  veces_confirmado: number;
  veces_corregido: number;
}

/**
 * What the app has learned about the user's merchants, and the only control
 * over it: "Olvidar" deletes the row, and the next receipt at that shop
 * starts learning from scratch.
 */
export function MerchantMemoryCard() {
  const [merchants, setMerchants] = useState<MerchantSummary[] | null>(null);

  const load = useCallback(async () => {
    const response = await fetch('/api/merchants');
    if (!response.ok) return;
    const data = (await response.json()) as { merchants: MerchantSummary[] };
    setMerchants(data.merchants);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one initial read from an API route; there is no external system to subscribe to
    void load();
  }, [load]);

  async function forget(id: string) {
    await fetch(`/api/merchants?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    await load();
  }

  return (
    <SettingsGroup
      title="Comercios aprendidos"
      footer="Confirmamos o corregimos la categoría de cada compra a partir de lo que ya sabes de ese comercio. Olvidar uno hace que el próximo recibo empiece de cero."
    >
      {merchants === null ? (
        <SettingsRow
          label={<span className="font-normal text-faint">Cargando…</span>}
        />
      ) : merchants.length === 0 ? (
        <SettingsRow
          label={
            <span className="font-normal text-subtle">
              Todavía no hemos aprendido nada. Sube un recibo para empezar.
            </span>
          }
          className="[&_.truncate]:whitespace-normal"
        />
      ) : (
        <ul className="divide-y divide-hairline">
          {merchants.map((merchant) => (
            <li key={merchant.id}>
              <SettingsRow
                icon={<CategoryTile name={merchant.tipo} />}
                trailing={
                  <button
                    type="button"
                    aria-label={`Olvidar ${merchant.canonical_name}`}
                    onClick={async () => await forget(merchant.id)}
                    className="h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold text-subtle transition-colors hover:bg-surface-2 hover:text-foreground"
                  >
                    Olvidar
                  </button>
                }
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium">
                    {merchant.canonical_name}
                  </div>
                  <div className="text-[13px] leading-snug text-subtle">
                    <span>{merchant.tipo ?? 'Sin categoría'}</span>
                    <span className="text-faint"> · </span>
                    <span className="text-faint">
                      {plural(merchant.veces_visto, 'compra', 'compras')}
                      {merchant.veces_confirmado > 0 &&
                        ` · ${plural(
                          merchant.veces_confirmado,
                          'confirmada',
                          'confirmadas',
                        )}`}
                      {merchant.veces_corregido > 0 &&
                        ` · ${plural(
                          merchant.veces_corregido,
                          'corregida',
                          'corregidas',
                        )}`}
                    </span>
                  </div>
                </div>
              </SettingsRow>
            </li>
          ))}
        </ul>
      )}
    </SettingsGroup>
  );
}
