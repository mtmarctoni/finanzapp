'use client';

import { Github, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getProviders, signIn, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { AuthShell, LogoTile } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SignIn() {
  const [pending, setPending] = useState<'github' | 'credentials' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  // The credentials provider only exists outside production with
  // DEV_CREDENTIALS set; ask the server instead of guessing.
  const [hasCredentials, setHasCredentials] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty callbackUrl query param must fall back to '/'
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const { data: session } = useSession();
  const isLoading = pending !== null;

  useEffect(() => {
    if (session?.user) {
      router.push(callbackUrl);
    }
  }, [session, router, callbackUrl]);

  useEffect(() => {
    let cancelled = false;
    void getProviders()
      .then((providers) => {
        if (!cancelled) setHasCredentials(Boolean(providers?.credentials));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGithubSignIn = async () => {
    setPending('github');
    setError(null);
    try {
      await signIn('github', {
        callbackUrl,
      });
    } catch (error) {
      console.error('GitHub sign in error:', error);
      setError('Error al iniciar sesión con GitHub');
    } finally {
      setPending(null);
    }
  };

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor ingresa tu correo y contraseña');
      return;
    }

    setPending('credentials');
    setError(null);

    try {
      const result = await signIn('credentials', {
        redirect: true,
        email,
        password,
        callbackUrl,
      });

      if (result?.error) {
        setError('Credenciales inválidas');
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setError('Error al iniciar sesión');
    } finally {
      setPending(null);
    }
  };

  return (
    <AuthShell>
      <div className="flex flex-col items-center text-center">
        <LogoTile />
        <h1 className="mt-6 text-[32px] font-bold leading-[1.1] tracking-[-0.045em]">
          Bienvenido
        </h1>
        <p className="mt-2 text-[15px] text-subtle">
          Inicia sesión para ver tus finanzas.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-8 rounded-[14px] bg-negative/10 px-4 py-3 text-center text-[13px] font-medium text-negative"
        >
          {error}
        </p>
      )}

      <Button
        type="button"
        size="lg"
        onClick={handleGithubSignIn}
        disabled={isLoading}
        className="mt-8 w-full bg-foreground text-background hover:bg-foreground/90"
      >
        {pending === 'github' ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Github />
        )}
        Continuar con GitHub
      </Button>

      {hasCredentials && (
        <>
          <div className="my-7 flex items-center gap-3 text-[12px] text-faint">
            <span className="h-px flex-1 bg-hairline" />
            Acceso de desarrollo
            <span className="h-px flex-1 bg-hairline" />
          </div>

          <form onSubmit={handleCredentialsSignIn} className="space-y-3">
            <div className="overflow-hidden rounded-[16px] border border-hairline bg-surface">
              <label htmlFor="email" className="sr-only">
                Correo electrónico
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
                className="h-12 rounded-none border-0 bg-transparent px-4 focus-visible:ring-0"
              />
              <div className="mx-4 h-px bg-hairline" />
              <label htmlFor="password" className="sr-only">
                Contraseña
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                className="h-12 rounded-none border-0 bg-transparent px-4 focus-visible:ring-0"
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {pending === 'credentials' && (
                <Loader2 className="animate-spin" />
              )}
              Iniciar sesión
            </Button>
            <p className="text-center text-[12px] text-faint">
              Usa: test@example.com / password123
            </p>
          </form>
        </>
      )}

      <p className="mt-10 text-center text-[12px] text-faint">
        Solo para usuarios autorizados.
      </p>
    </AuthShell>
  );
}
