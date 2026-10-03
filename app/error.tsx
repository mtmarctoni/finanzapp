'use client';

import { AlertCircle, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex min-h-[70dvh] max-w-sm flex-col items-center justify-center text-center"
    >
      <span className="grid h-16 w-16 place-items-center rounded-[20px] border border-hairline bg-surface text-subtle">
        <AlertCircle className="h-7 w-7" />
      </span>
      <h1 className="mt-6 text-[32px] font-bold leading-[1.1] tracking-[-0.045em]">
        Algo salió mal
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-subtle">
        No pudimos cargar esta pantalla. Tus datos están a salvo; vuelve a
        intentarlo en un momento.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-[11px] text-faint">
          Código {error.digest}
        </p>
      )}
      <div className="mt-8 grid w-full grid-cols-2 gap-2">
        <Button variant="secondary" size="lg" asChild>
          <Link href="/">Ir al inicio</Link>
        </Button>
        <Button
          size="lg"
          onClick={() => reset()}
          className="bg-foreground text-background hover:bg-foreground/90"
        >
          <RotateCcw />
          Reintentar
        </Button>
      </div>
    </div>
  );
}
