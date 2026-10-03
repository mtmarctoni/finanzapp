'use client';

import { Sparkles, Loader2, AlertCircle, Wand2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { PaidFallbackDialog } from './PaidFallbackDialog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const EXAMPLES = [
  '50 € cena ayer',
  '12,40 € Mercadona con tarjeta',
  'Nómina 2.500 € el día 1',
];

type QuickEntryStatus = 'idle' | 'loading' | 'needs-confirmation' | 'error';

interface FallbackError {
  requiresConfirmation: boolean;
  fallbackModel: string;
  estimatedCost: string;
  freeProviderErrors: string[];
}

export function QuickEntryBar() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<QuickEntryStatus>('idle');
  const [message, setMessage] = useState('');
  const [fallbackError, setFallbackError] = useState<FallbackError | null>(
    null,
  );

  // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical hydration-detect pattern
  useEffect(() => setMounted(true), []);

  if (!mounted || sessionStatus !== 'authenticated') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = text.trim();
    if (!trimmed) return;

    setStatus('loading');
    setMessage('');
    setFallbackError(null);

    try {
      const response = await fetch('/api/ai/parse-for-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: trimmed,
        }),
      });

      const data = await response.json();

      if (data.success && data.parsedData) {
        // Parse successful - redirect to /new with pre-filled data
        const queryParams = new URLSearchParams();

        // Add parsed data to query params
        Object.entries(data.parsedData).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            queryParams.set(key, String(value));
          }
        });

        // Add original text and AI metadata
        queryParams.set('ai_text', trimmed);
        queryParams.set('ai_provider', data.providerUsed ?? 'unknown');
        queryParams.set('ai_model', data.modelUsed ?? 'unknown');
        if (data.isPaidFallback) {
          queryParams.set('ai_cost', String(data.costUsd ?? 0));
        }

        // Redirect to /new with parsed data
        router.push(`/new?${queryParams.toString()}`);
      } else if (data.requiresConfirmation) {
        // Need paid fallback confirmation
        setStatus('needs-confirmation');
        setFallbackError({
          requiresConfirmation: true,
          fallbackModel: data.fallbackModel,
          estimatedCost: data.estimatedCost,
          freeProviderErrors: data.freeProviderErrors ?? [],
        });
      } else {
        setStatus('error');
        setMessage(data.error ?? 'Error al procesar.');
        setTimeout(() => setStatus('idle'), 4000);
      }
    } catch (error) {
      console.error('Parse error:', error);
      setStatus('error');
      setMessage('Error de conexión.');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  // Handle paid fallback confirmation
  const handleConfirmPaidFallback = async () => {
    if (!fallbackError || !text.trim()) return;

    setFallbackError(null);
    setStatus('loading');

    try {
      const response = await fetch('/api/ai/parse-for-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          confirmPaidFallback: true,
        }),
      });

      const data = await response.json();

      if (data.success && data.parsedData) {
        // Paid fallback succeeded - redirect to /new
        const queryParams = new URLSearchParams();

        Object.entries(data.parsedData).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            queryParams.set(key, String(value));
          }
        });

        queryParams.set('ai_text', text.trim());
        queryParams.set('ai_provider', data.providerUsed ?? 'opencode');
        queryParams.set('ai_model', data.modelUsed ?? 'kimi-k2.5');
        queryParams.set('ai_cost', String(data.costUsd ?? 0));
        queryParams.set('ai_paid', 'true');

        router.push(`/new?${queryParams.toString()}`);
      } else {
        setStatus('error');
        setMessage(data.error ?? 'Error al procesar con modelo de pago.');
        setTimeout(() => setStatus('idle'), 4000);
      }
    } catch (error) {
      console.error('Paid fallback error:', error);
      setStatus('error');
      setMessage('Error de conexión.');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  const handleDeclinePaidFallback = () => {
    setFallbackError(null);
    setStatus('idle');
  };

  return (
    <>
      {/* Paid Fallback Dialog */}
      <PaidFallbackDialog
        isOpen={!!fallbackError}
        onClose={handleDeclinePaidFallback}
        onConfirm={handleConfirmPaidFallback}
        onDecline={handleDeclinePaidFallback}
        estimatedCost={fallbackError?.estimatedCost ?? '$0.001 - $0.005'}
        modelName={fallbackError?.fallbackModel ?? 'Kimi K2.5'}
      />

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <Sparkles className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <Input
            type="text"
            aria-label="Describe tu entrada"
            placeholder="50 € cena ayer con tarjeta"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={status === 'loading'}
            autoFocus
            enterKeyHint="go"
            className="h-12 rounded-[14px] pl-10 text-base"
          />
        </div>
        <div className="rail -mx-4 px-4">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setText(example)}
              className="h-9 shrink-0 rounded-full bg-surface-3 px-3.5 text-[13px] font-medium text-subtle"
            >
              {example}
            </button>
          ))}
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={status === 'loading' || !text.trim()}
          className="w-full"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" />
              Usar IA
            </>
          )}
        </Button>
        {status === 'error' && message && (
          <p className="flex items-center justify-center gap-1.5 text-sm text-negative">
            <AlertCircle className="h-4 w-4" />
            {message}
          </p>
        )}
      </form>
    </>
  );
}
