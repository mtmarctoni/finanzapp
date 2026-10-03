'use client';

import {
  AlertTriangle,
  BookOpen,
  Copy,
  ExternalLink,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  SettingsGroup,
  SettingsIcon,
  SettingsRow,
} from '@/components/settings/settings-group';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type ApiKeyItem = {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return 'Nunca';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha inválida';

  return date.toLocaleString('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function ApiKeyManager() {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const activeKeys = useMemo(
    () => apiKeys.filter((item) => item.is_active),
    [apiKeys],
  );

  const loadApiKeys = useCallback(async () => {
    try {
      const response = await fetch('/api/api-keys', { cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok) {
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- untyped API payload; empty error string must still fall back to default message
        throw new Error(payload.error || 'No se pudieron cargar las llaves');
      }

      setApiKeys(payload.data ?? []);
    } catch (error) {
      console.error('Failed to load API keys:', error);
      toast({
        title: 'No se pudieron cargar las llaves',
        description: 'Recarga la página e inténtalo otra vez.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    // Defer past the synchronous effect body so state updates triggered by
    // loadApiKeys do not cause cascading renders.
    void Promise.resolve().then(() => {
      void loadApiKeys();
    });
  }, [loadApiKeys]);

  const handleRefreshKeys = () => {
    setLoading(true);
    void loadApiKeys();
  };

  const handleCreateKey = async () => {
    const trimmedName = newKeyName.trim();

    if (!trimmedName) {
      toast({
        title: 'Nombre requerido',
        description:
          'Ponle un nombre claro a la integración, por ejemplo Zapier o n8n.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: trimmedName }),
      });

      const payload = await response.json();

      if (!response.ok) {
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- untyped API payload; empty error string must still fall back to default message
        throw new Error(payload.error || 'No se pudo crear la llave');
      }

      setGeneratedKey(payload.data.plaintext);
      setApiKeys((current) => [
        {
          id: payload.data.id,
          user_id: '',
          name: payload.data.name,
          is_active: payload.data.is_active,
          created_at: payload.data.created_at,
          updated_at: payload.data.updated_at,
          last_used_at: payload.data.last_used_at,
        },
        ...current,
      ]);
      setNewKeyName('');

      toast({
        title: 'Llave creada',
        description: 'Guárdala ahora. Después no se vuelve a mostrar.',
      });
    } catch (error) {
      console.error('Failed to create API key:', error);
      toast({
        title: 'No se pudo crear la llave',
        description: 'Revisa el nombre y vuelve a intentar.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    setRevokingId(id);

    try {
      const response = await fetch(`/api/api-keys/${id}`, {
        method: 'DELETE',
      });

      const payload = await response.json();

      if (!response.ok) {
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- untyped API payload; empty error string must still fall back to default message
        throw new Error(payload.error || 'No se pudo revocar la llave');
      }

      setApiKeys((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                is_active: false,
                updated_at: new Date().toISOString(),
              }
            : item,
        ),
      );

      toast({
        title: 'Llave revocada',
        description: 'Las apps externas ya no podrán usar esta integración.',
      });
    } catch (error) {
      console.error('Failed to revoke API key:', error);
      toast({
        title: 'No se pudo revocar la llave',
        description: 'Inténtalo otra vez en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopyKey = async () => {
    if (!generatedKey) return;

    try {
      await navigator.clipboard.writeText(generatedKey);
      toast({
        title: 'Llave copiada',
        description: 'Ya la puedes pegar en tu otra app.',
      });
    } catch (error) {
      console.error('Failed to copy API key:', error);
      toast({
        title: 'No se pudo copiar',
        description: 'Cópiala manualmente antes de cerrar este mensaje.',
        variant: 'destructive',
      });
    }
  };

  return (
    <SettingsGroup
      title="Claves API"
      action={
        <span className="flex items-center gap-1">
          <span className="text-[12px] text-faint">
            {activeKeys.length} {activeKeys.length === 1 ? 'activa' : 'activas'}
          </span>
          <button
            type="button"
            onClick={handleRefreshKeys}
            disabled={loading}
            aria-label="Recargar llaves"
            className="-mr-2 grid h-8 w-8 place-items-center rounded-full text-faint transition-colors hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', loading && 'animate-spin')}
            />
          </button>
        </span>
      }
      footer={
        <>
          Crea llaves para que otras apps registren movimientos sin tocar la
          base de datos desde el cliente. Ponle un nombre que diga dónde vive,
          por ejemplo n8n gastos.
        </>
      }
    >
      {generatedKey && (
        <div className="space-y-3 bg-surface-2 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
            <div>
              <p className="text-[15px] font-semibold">
                Guarda esta llave ahora
              </p>
              <p className="text-[13px] text-subtle">
                Solo se muestra una vez. Si la pierdes, tendrás que revocarla y
                crear otra.
              </p>
            </div>
          </div>
          <div className="break-all rounded-[12px] border border-hairline bg-background p-3 font-mono text-[12px]">
            {generatedKey}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={handleCopyKey}>
              <Copy />
              Copiar llave
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setGeneratedKey(null)}
            >
              Ocultar
            </Button>
          </div>
        </div>
      )}

      <form
        className="flex items-center gap-2 p-2 pl-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreateKey();
        }}
      >
        <Input
          value={newKeyName}
          onChange={(event) => setNewKeyName(event.target.value)}
          placeholder="Nombre de la integración"
          aria-label="Nombre de la nueva llave"
          className="h-10 flex-1 border-transparent bg-transparent px-0 focus-visible:ring-0"
        />
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          disabled={submitting}
          className="h-10 shrink-0"
        >
          {submitting ? 'Creando...' : 'Crear llave'}
        </Button>
      </form>

      {loading ? (
        <SettingsRow
          label={<span className="text-subtle">Cargando llaves...</span>}
        />
      ) : activeKeys.length === 0 ? (
        <SettingsRow
          label={
            <span className="font-normal text-subtle">
              Aún no tienes llaves creadas.
            </span>
          }
        />
      ) : (
        activeKeys.map((item) => (
          <SettingsRow
            key={item.id}
            icon={
              <SettingsIcon>
                <KeyRound />
              </SettingsIcon>
            }
            label={item.name}
            detail={`Creada ${formatDate(item.created_at)} · Último uso: ${formatDate(item.last_used_at)}`}
            trailing={
              <button
                type="button"
                onClick={async () => handleRevokeKey(item.id)}
                disabled={revokingId === item.id}
                aria-label={`Revocar llave ${item.name}`}
                className="h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold text-negative transition-colors hover:bg-negative/10 disabled:opacity-50"
              >
                {revokingId === item.id ? 'Revocando...' : 'Revocar'}
              </button>
            }
          />
        ))
      )}

      <a
        href="/docs/public-entry-api"
        target="_blank"
        className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/60"
      >
        <SettingsIcon>
          <BookOpen />
        </SettingsIcon>
        <span className="flex-1 text-[15px] font-medium">
          Documentación de la API
        </span>
        <ExternalLink className="h-4 w-4 text-faint" />
      </a>
    </SettingsGroup>
  );
}
