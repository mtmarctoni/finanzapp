'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  ChevronRight,
  LayoutGrid,
  LogOut,
  MessageCircle,
  Moon,
  Plus,
  Sun,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { openChat } from '@/components/ai/chat-events';
import { useQuickAdd } from '@/components/quick-add/quick-add-context';
import { MOBILE_TABS, MORE_ITEMS, isActivePath } from '@/config';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const pathname = usePathname();
  const { status } = useSession();
  const { open } = useQuickAdd();
  const [moreOpen, setMoreOpen] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- close on navigation
  useEffect(() => setMoreOpen(false), [pathname]);

  if (pathname.startsWith('/auth') || status !== 'authenticated') return null;

  const moreActive = MORE_ITEMS.some((i) => isActivePath(pathname, i.href));
  const [first, second, third] = MOBILE_TABS;

  return (
    <>
      {/* Content fades into black before it reaches the bar. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 h-36 bg-gradient-to-t from-background via-background/80 to-transparent md:hidden"
      />
      <nav
        aria-label="Navegación principal"
        className="glass fixed inset-x-0 bottom-0 z-50 border-t border-hairline pb-safe md:hidden"
      >
        <div className="grid h-16 grid-cols-5 items-center px-2">
          <Tab item={first} pathname={pathname} />
          <Tab item={second} pathname={pathname} />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={open}
              aria-label="Nuevo registro"
              className="grid h-12 w-16 place-items-center rounded-[18px] bg-primary text-primary-foreground transition-transform active:scale-95"
            >
              <Plus className="h-6 w-6" strokeWidth={2.6} />
            </button>
          </div>
          <Tab item={third} pathname={pathname} />
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            className={cn(
              'flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
              moreActive ? 'text-foreground' : 'text-faint',
            )}
          >
            <LayoutGrid className="h-[22px] w-[22px]" strokeWidth={1.8} />
            Más
          </button>
        </div>
      </nav>
      <MoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        pathname={pathname}
      />
    </>
  );
}

function Tab({
  item,
  pathname,
}: {
  item: (typeof MOBILE_TABS)[number];
  pathname: string;
}) {
  const active = isActivePath(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
        active ? 'text-foreground' : 'text-faint',
      )}
    >
      <item.icon
        className="h-[22px] w-[22px]"
        strokeWidth={active ? 2.2 : 1.8}
      />
      {item.name}
    </Link>
  );
}

function MoreSheet({
  open,
  onOpenChange,
  pathname,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pathname: string;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const { data: session } = useSession();
  const isDark = resolvedTheme !== 'light';

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-[var(--scrim)] animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="glass-sheet fixed inset-x-0 bottom-0 z-[61] rounded-t-[28px] border-t border-hairline-strong px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-2 outline-none animate-sheet-in"
        >
          <div className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-surface-3" />
          <DialogPrimitive.Title className="px-1 pb-3 text-[13px] font-medium text-subtle">
            {session?.user.name ?? 'Más'}
          </DialogPrimitive.Title>

          <div className="overflow-hidden rounded-[20px] border border-hairline bg-surface">
            {MORE_ITEMS.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className="flex h-14 items-center gap-3 px-4 transition-colors active:bg-surface-2 [&+&]:border-t [&+&]:border-hairline"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-surface-3">
                    <item.icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="flex-1 text-[15px] font-semibold tracking-[-0.01em]">
                    {item.name}
                  </span>
                  <ChevronRight className="h-4 w-4 text-faint" />
                </Link>
              );
            })}
          </div>

          <div className="mt-3 overflow-hidden rounded-[20px] border border-hairline bg-surface">
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                openChat();
              }}
              className="flex h-14 w-full items-center gap-3 px-4 text-left active:bg-surface-2"
            >
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-surface-3">
                <MessageCircle className="h-[18px] w-[18px]" />
              </span>
              <span className="flex-1 text-[15px] font-semibold tracking-[-0.01em]">
                Asistente
              </span>
              <ChevronRight className="h-4 w-4 text-faint" />
            </button>
            <button
              type="button"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="flex h-14 w-full items-center gap-3 border-t border-hairline px-4 text-left active:bg-surface-2"
            >
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-surface-3">
                {isDark ? (
                  <Sun className="h-[18px] w-[18px]" />
                ) : (
                  <Moon className="h-[18px] w-[18px]" />
                )}
              </span>
              <span className="flex-1 text-[15px] font-semibold tracking-[-0.01em]">
                {isDark ? 'Tema claro' : 'Tema oscuro'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: '/auth/signin' })}
              className="flex h-14 w-full items-center gap-3 border-t border-hairline px-4 text-left text-negative active:bg-surface-2"
            >
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-negative/10">
                <LogOut className="h-[18px] w-[18px]" />
              </span>
              <span className="flex-1 text-[15px] font-semibold tracking-[-0.01em]">
                Cerrar sesión
              </span>
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
