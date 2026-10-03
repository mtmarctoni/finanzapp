'use client';

import { Check, Copy, LogOut, Moon, ShieldCheck, Sun } from 'lucide-react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useState, useSyncExternalStore } from 'react';

import { ApiKeyManager } from '@/components/api-key-manager';
import { MerchantMemoryCard } from '@/components/merchants/MerchantMemoryCard';
import { PageHeader } from '@/components/page-header';
import {
  SettingsGroup,
  SettingsIcon,
  SettingsRow,
} from '@/components/settings/settings-group';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function initials(name: string | null | undefined) {
  if (!name) return 'U';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

/** The theme is only known after hydration; render neutral until then. */
const subscribeNoop = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

function ThemeRows() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const options = [
    { value: 'dark', label: 'Oscuro', icon: Moon },
    { value: 'light', label: 'Claro', icon: Sun },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="divide-y divide-hairline"
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = mounted && resolvedTheme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className="flex min-h-14 w-full items-center gap-3 px-4 text-left transition-colors hover:bg-surface-2/60"
          >
            <SettingsIcon>
              <Icon />
            </SettingsIcon>
            <span className="flex-1 text-[15px] font-medium">{label}</span>
            <Check
              className={cn(
                'h-[18px] w-[18px] text-foreground transition-opacity',
                active ? 'opacity-100' : 'opacity-0',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

export default function UserPage() {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn('github', {
        callbackUrl: '/user',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut({
        callbackUrl: '/auth/signin',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyId = async () => {
    if (!session?.user.id) return;
    try {
      await navigator.clipboard.writeText(session.user.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked; the id stays visible to copy by hand.
    }
  };

  if (status === 'loading') {
    return <PageHeader title="Perfil" />;
  }

  if (!session) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-[32px] font-bold tracking-[-0.045em]">
          Bienvenido
        </h1>
        <p className="text-[15px] text-subtle">
          Inicia sesión para ver tu perfil
        </p>
        <Button onClick={handleSignIn} className="mt-4" disabled={isLoading}>
          {isLoading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            'Iniciar sesión'
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Perfil" />

      <div className="space-y-7">
        <section className="flex flex-col items-center gap-3 pb-1 text-center">
          <Avatar className="h-20 w-20 border border-hairline-strong">
            <AvatarImage src={session.user.image ?? undefined} alt="" />
            <AvatarFallback className="bg-surface-3 text-[26px] font-semibold tracking-[-0.03em] text-foreground">
              {initials(session.user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 max-w-full">
            <h2 className="truncate text-[22px] font-semibold tracking-[-0.03em]">
              {session.user.name}
            </h2>
            <p className="truncate text-[15px] text-subtle">
              {session.user.email}
            </p>
          </div>
        </section>

        <SettingsGroup title="Cuenta">
          <SettingsRow
            icon={
              <SettingsIcon className="bg-positive/15 text-positive">
                <ShieldCheck />
              </SettingsIcon>
            }
            label="Estado"
            trailing={
              <span className="flex items-center gap-2 text-[15px] text-subtle">
                <span className="h-2 w-2 rounded-full bg-positive" />
                Conectado
              </span>
            }
          />
          <SettingsRow
            label="ID de usuario"
            detail={
              <span className="font-mono text-[12px]">{session.user.id}</span>
            }
            trailing={
              <button
                type="button"
                onClick={copyId}
                aria-label="Copiar ID de usuario"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-positive" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            }
          />
        </SettingsGroup>

        <ApiKeyManager />

        <MerchantMemoryCard />

        <SettingsGroup title="Apariencia">
          <ThemeRows />
        </SettingsGroup>

        <SettingsGroup>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isLoading}
            className="flex min-h-14 w-full items-center justify-center gap-2 px-4 text-[15px] font-semibold text-negative transition-colors hover:bg-negative/10 disabled:opacity-50"
          >
            {isLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Cerrar sesión
          </button>
        </SettingsGroup>
      </div>
    </div>
  );
}
