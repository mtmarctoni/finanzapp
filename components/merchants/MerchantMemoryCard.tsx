'use client';

import { Brain, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="h-4 w-4" />
          Comercios aprendidos
        </CardTitle>
        <CardDescription>
          Confirmamos o corregimos la categoría de cada compra a partir de lo
          que ya sabes de ese comercio.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {merchants === null ? null : merchants.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hemos aprendido nada. Sube un recibo para empezar.
          </p>
        ) : (
          <ul className="space-y-2">
            {merchants.map((merchant) => (
              <li
                key={merchant.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{merchant.canonical_name}</span>
                  <Badge variant="secondary">
                    {merchant.tipo ?? 'Sin categoría'}
                  </Badge>
                  <span className="text-muted-foreground">
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
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Olvidar ${merchant.canonical_name}`}
                  onClick={async () => await forget(merchant.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
