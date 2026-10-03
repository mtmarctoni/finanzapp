'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { MessageSquare, X, Send, Loader2, DollarSign } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';

import { ChatMessage } from './ChatMessage';
import { PaidFallbackDialog } from './PaidFallbackDialog';
import { OPEN_CHAT_EVENT } from './chat-events';

import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

interface FallbackError {
  requiresConfirmation: boolean;
  fallbackModel: string;
  estimatedCost: string;
  freeProviderErrors: string[];
}

export function ChatWidget() {
  const { status: sessionStatus, data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [fallbackError, setFallbackError] = useState<FallbackError | null>(
    null,
  );
  const [paidSessionActive, setPaidSessionActive] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical hydration-detect pattern
  useEffect(() => setMounted(true), []);

  // Opened from the sidebar or the mobile "Más" sheet; there is no floating
  // launcher, so the add button is the only floating action on screen.
  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener(OPEN_CHAT_EVENT, open);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, open);
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/ai/chat',
        headers: paidSessionActive ? { 'X-Confirm-Paid': 'true' } : undefined,
      }),
    [paidSessionActive],
  );

  const { messages, status, error, sendMessage, setMessages, clearError } =
    useChat({
      transport,
    });

  const isLoading = status === 'streaming' || status === 'submitted';
  const hasError = status === 'error' || !!error;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Check for paid session confirmation status on mount
  useEffect(() => {
    const checkConfirmation = async () => {
      try {
        const response = await fetch('/api/ai/confirm-paid');
        if (response.ok) {
          const data = await response.json();
          if (data.confirmed) {
            setPaidSessionActive(true);
          }
        }
      } catch (error) {
        console.error('Error checking confirmation status:', error);
      }
    };

    if (session) {
      checkConfirmation();
    }
  }, [session]);

  // Handle errors - check if it's a fallback error
  useEffect(() => {
    if (error) {
      // Try to parse the error message as JSON safely
      try {
        // Check if error message looks like JSON before parsing
        if (
          error.message &&
          (error.message.trim().startsWith('{') ||
            error.message.trim().startsWith('['))
        ) {
          const errorData = JSON.parse(error.message);
          // Validate that it has the expected fallback error structure
          if (
            errorData &&
            typeof errorData === 'object' &&
            errorData.requiresConfirmation === true
          ) {
            // Use microtask to avoid setting state synchronously in effect
            queueMicrotask(() => {
              setFallbackError({
                requiresConfirmation: true,
                fallbackModel:
                  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- untyped JSON.parse payload; empty string must still fall back to default
                  errorData.fallbackModel || 'Kimi K2.5',
                estimatedCost:
                  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- untyped JSON.parse payload; empty string must still fall back to default
                  errorData.estimatedCost || '$0.001 - $0.005',
                freeProviderErrors: Array.isArray(errorData.freeProviderErrors)
                  ? errorData.freeProviderErrors
                  : [],
              });
            });
          }
        }
      } catch {
        // Not a JSON error or not a valid fallback error - ignore
        logger.info('Regular error:', error.message);
      }
    }
  }, [error]);

  // Custom send message handler with fallback support
  const handleSendMessage = useCallback(
    async (text: string) => {
      setPendingMessage(text);

      try {
        await sendMessage({ text });
      } catch (err) {
        console.error('Send message error:', err);
      }
    },
    [sendMessage],
  );

  // Handle paid fallback confirmation
  const handleConfirmPaidFallback = useCallback(async () => {
    if (!pendingMessage) return;

    setPaidSessionActive(true);
    setFallbackError(null);
    clearError();

    // Retry the message with paid fallback
    try {
      await sendMessage({ text: pendingMessage });
    } catch (err) {
      console.error('Retry error:', err);
    }

    setPendingMessage(null);
  }, [pendingMessage, sendMessage, clearError]);

  // Handle decline
  const handleDeclinePaidFallback = useCallback(() => {
    setFallbackError(null);
    setPendingMessage(null);
    clearError();
  }, [clearError]);

  // Clear paid session after 10 minutes
  useEffect(() => {
    if (!paidSessionActive) return;

    const timeout = setTimeout(
      () => {
        setPaidSessionActive(false);
      },
      10 * 60 * 1000,
    ); // 10 minutes

    return () => clearTimeout(timeout);
  }, [paidSessionActive]);

  if (!mounted || sessionStatus !== 'authenticated') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = inputRef.current;
    if (!input) return;

    const text = input.value.trim();
    if (!text || isLoading) return;

    input.value = '';
    await handleSendMessage(text);
  };

  const handleClearChat = () => {
    setMessages([]);
    setPaidSessionActive(false);
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

      {/* Chat panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Asistente financiero"
          className="glass-sheet fixed inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)+12px)] z-[70] flex flex-col overflow-hidden rounded-t-[28px] border-t border-hairline-strong pb-safe shadow-2xl animate-sheet-in md:inset-x-auto md:bottom-6 md:right-6 md:top-auto md:h-[32rem] md:w-[400px] md:rounded-[24px] md:border md:pb-0"
        >
          {/* Header */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-4">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-semibold tracking-[-0.01em]">
                Asistente financiero
              </h3>
              {paidSessionActive && (
                <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Paid
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearChat}
                  className="text-xs h-7 px-2"
                >
                  Limpiar
                </Button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-subtle transition-colors hover:text-foreground"
                aria-label="Cerrar chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-3">
            {messages.length === 0 && (
              <div className="h-full flex items-center justify-center text-center">
                <div className="text-muted-foreground text-sm space-y-2">
                  <MessageSquare className="h-8 w-8 mx-auto opacity-50" />
                  <p>Pregunta sobre tus finanzas o crea entradas.</p>
                  <p className="text-xs opacity-70">
                    Ej: &ldquo;Cuanto gaste este mes?&rdquo;
                  </p>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {isLoading && messages.length > 0 && (
              <div className="flex justify-start mb-3">
                <div className="bg-muted rounded-lg px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}

            {hasError && !fallbackError && (
              <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-center justify-between">
                <span>Error: {error?.message ?? 'Algo salió mal'}</span>
                <button
                  onClick={clearError}
                  className="ml-2 text-xs underline hover:no-underline"
                >
                  Cerrar
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-hairline p-3">
            {paidSessionActive && (
              <div className="mb-2 text-xs text-muted-foreground flex items-center justify-between">
                <span className="text-yellow-600 dark:text-yellow-400">
                  Using paid model (session expires in 10 min)
                </span>
                <button
                  onClick={() => setPaidSessionActive(false)}
                  className="text-xs underline hover:no-underline"
                >
                  Disable
                </button>
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                placeholder="Escribe un mensaje..."
                disabled={isLoading}
                className="h-11 flex-1 rounded-full bg-surface-2 px-4 text-base outline-none placeholder:text-faint focus:ring-2 focus:ring-ring/30 disabled:opacity-50 md:text-sm"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isLoading}
                className="h-11 w-11 rounded-full p-0"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
