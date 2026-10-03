'use client';

import { ChevronRight, Github, Lock } from 'lucide-react';
import Link from 'next/link';

import { AuthMessage, AuthShell } from '@/components/auth/auth-shell';

const LINKS = [
  {
    href: 'https://github.com/mtmarctoni/finanzapp',
    label: 'Ver el repositorio',
    detail: 'github.com/mtmarctoni/finanzapp',
  },
  {
    href: 'https://github.com/mtmarctoni/finanzapp/issues/new',
    label: 'Solicitar acceso',
    detail: 'Abre una issue en GitHub',
  },
];

export default function Unauthorized() {
  return (
    <AuthShell>
      <AuthMessage icon={<Lock />} title="Acceso no autorizado">
        Este proyecto está protegido y solo está disponible para usuarios
        autorizados.
      </AuthMessage>

      <p className="mt-8 px-4 text-[13px] font-semibold text-subtle">
        Si quieres contribuir o saber más
      </p>
      <ul className="mt-2 divide-y divide-hairline overflow-hidden rounded-[20px] border border-hairline bg-surface">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              target="_blank"
              className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-surface-3 text-subtle">
                <Github className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">
                  {link.label}
                </span>
                <span className="block truncate text-[13px] text-subtle">
                  {link.detail}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-faint" />
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/auth/signin"
        className="mt-6 block text-center text-[13px] font-medium text-subtle hover:text-foreground"
      >
        Volver a iniciar sesión
      </Link>
    </AuthShell>
  );
}
