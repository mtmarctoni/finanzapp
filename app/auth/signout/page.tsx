'use client';

import { Loader2 } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useEffect } from 'react';

import { AuthMessage, AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';

export default function SignOut() {
  useEffect(() => {
    // Sign out the user
    signOut({
      callbackUrl: '/auth/signin',
      redirect: true,
    });
  }, []);

  return (
    <AuthShell>
      <AuthMessage
        icon={<Loader2 className="animate-spin" />}
        title="Cerrando sesión"
      >
        Estamos cerrando tu sesión. Serás redirigido al inicio de sesión.
      </AuthMessage>
      <Button
        variant="secondary"
        size="lg"
        onClick={() => {
          signOut({ callbackUrl: '/auth/signin' });
        }}
        className="mt-8 w-full"
      >
        Cerrar sesión ahora
      </Button>
    </AuthShell>
  );
}
