'use client';

import { AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { AuthMessage, AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';

export default function Error() {
  const router = useRouter();

  return (
    <AuthShell>
      <AuthMessage icon={<AlertCircle />} title="No pudimos iniciar sesión">
        Hubo un error al iniciar sesión. Por favor, inténtalo de nuevo.
      </AuthMessage>
      <Button
        size="lg"
        onClick={() => router.push('/auth/signin')}
        className="mt-8 w-full bg-foreground text-background hover:bg-foreground/90"
      >
        Volver a intentar
      </Button>
    </AuthShell>
  );
}
