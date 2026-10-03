'use client';

import {
  LogOut,
  MessageCircle,
  Moon,
  Plus,
  Sun,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';

import { openChat } from '@/components/ai/chat-events';
import { useQuickAdd } from '@/components/quick-add/quick-add-context';
import { APP_NAME, NAV_ITEMS, isActivePath } from '@/config';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { open } = useQuickAdd();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  if (pathname.startsWith('/auth') || status !== 'authenticated') return null;

  const name = session.user.name ?? '';
  const initials =
    name
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'Yo';
  const userActive = isActivePath(pathname, '/user');

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-hairline px-3 py-5 md:flex">
      <Link
        href="/dashboard"
        className="mb-6 flex h-11 items-center gap-2.5 px-2.5 text-[17px] font-bold tracking-[-0.03em]"
      >
        <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-primary text-[15px] font-extrabold text-primary-foreground">
          F
        </span>
        <span className="capitalize">{APP_NAME.toLowerCase()}</span>
      </Link>

      <button
        type="button"
        onClick={open}
        className="mb-5 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-bold text-primary-foreground transition-transform active:scale-[0.98]"
      >
        <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
        Nuevo registro
      </button>

      <nav aria-label="Navegación principal" className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors',
                active
                  ? 'bg-surface-2 font-semibold text-foreground'
                  : 'font-medium text-subtle hover:bg-surface hover:text-foreground',
              )}
            >
              <item.icon
                className="h-[18px] w-[18px]"
                strokeWidth={active ? 2.2 : 1.8}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5">
        <button
          type="button"
          onClick={openChat}
          className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-subtle transition-colors hover:bg-surface hover:text-foreground"
        >
          <MessageCircle className="h-[18px] w-[18px]" strokeWidth={1.8} />
          Asistente
        </button>
        <button
          type="button"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-subtle transition-colors hover:bg-surface hover:text-foreground"
        >
          {isDark ? (
            <Sun className="h-[18px] w-[18px]" strokeWidth={1.8} />
          ) : (
            <Moon className="h-[18px] w-[18px]" strokeWidth={1.8} />
          )}
          {isDark ? 'Tema claro' : 'Tema oscuro'}
        </button>

        <div className="mt-3 flex items-center gap-2 border-t border-hairline pt-3">
          <Link
            href="/user"
            aria-current={userActive ? 'page' : undefined}
            className={cn(
              'flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1.5 transition-colors hover:bg-surface',
              userActive && 'bg-surface-2',
            )}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-hairline-strong bg-surface-2 text-[13px] font-bold">
              {initials || <UserRound className="h-4 w-4" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {name}
              </span>
              <span className="block text-xs text-faint">Perfil</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: '/auth/signin' })}
            aria-label="Cerrar sesión"
            className="grid h-9 w-9 place-items-center rounded-full text-faint transition-colors hover:bg-surface hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
