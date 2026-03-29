"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { MessageSquare, X, Send, Loader2, DollarSign } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { PaidFallbackDialog } from "./PaidFallbackDialog";

interface FallbackError {
  requiresConfirmation: boolean;
  fallbackModel: string;
  estimatedCost: string;
  freeProviderErrors: string[];
}

export function ChatWidget() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [fallbackError, setFallbackError] = useState<FallbackError | null>(
    null
  );
  const [paidSessionActive, setPaidSessionActive] = useState(false);
  const [lastRequestCost, setLastRequestCost] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        headers: paidSessionActive
          ? { "X-Confirm-Paid": "true" }
          : undefined,
      }),
    [paidSessionActive]
  );

  const {
    messages,
    status,
    error,
    sendMessage,
    setMessages,
    clearError,
  } = useChat({
    transport,
  });

  const isLoading = status === "streaming" || status === "submitted";
  const hasError = status === "error" || !!error;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
        const response = await fetch("/api/ai/confirm-paid");
        if (response.ok) {
          const data = await response.json();
          if (data.confirmed) {
            setPaidSessionActive(true);
          }
        }
      } catch (error) {
        console.error("Error checking confirmation status:", error);
      }
    };

    if (session) {
      checkConfirmation();
    }
  }, [session]);

  // Handle errors - check if it's a fallback error
  useEffect(() => {
    if (error) {
      // Try to parse the error message as JSON
      try {
        const errorData = JSON.parse(error.message);
        if (errorData.requiresConfirmation) {
          setFallbackError({
            requiresConfirmation: true,
            fallbackModel: errorData.fallbackModel,
            estimatedCost: errorData.estimatedCost,
            freeProviderErrors: errorData.freeProviderErrors || [],
          });
        }
      } catch {
        // Not a JSON error or not a fallback error
        console.log("Regular error:", error.message);
      }
    }
  }, [error]);

  // Custom send message handler with fallback support
  const handleSendMessage = useCallback(
    async (text: string) => {
      setPendingMessage(text);
      setLastRequestCost(0);

      try {
        await sendMessage({ text });
      } catch (err) {
        console.error("Send message error:", err);
      }
    },
    [sendMessage]
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
      console.error("Retry error:", err);
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

    const timeout = setTimeout(() => {
      setPaidSessionActive(false);
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearTimeout(timeout);
  }, [paidSessionActive]);

  if (!session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = inputRef.current;
    if (!input) return;

    const text = input.value.trim();
    if (!text || isLoading) return;

    input.value = "";
    await handleSendMessage(text);
  };

  const handleClearChat = () => {
    setMessages([]);
    setPaidSessionActive(false);
    setLastRequestCost(0);
  };

  return (
    <>
      {/* Paid Fallback Dialog */}
      <PaidFallbackDialog
        isOpen={!!fallbackError}
        onClose={handleDeclinePaidFallback}
        onConfirm={handleConfirmPaidFallback}
        onDecline={handleDeclinePaidFallback}
        estimatedCost={fallbackError?.estimatedCost || "$0.001 - $0.005"}
        modelName={fallbackError?.fallbackModel || "Kimi K2.5"}
      />

      {/* Floating trigger button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 z-50 lg:bottom-6 lg:right-6 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors flex items-center justify-center"
          aria-label="Abrir chat asistente"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 lg:bottom-6 lg:right-6 w-[calc(100vw-2rem)] max-w-sm h-[28rem] bg-background border border-border rounded-lg shadow-xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Asistente financiero</h3>
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
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
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
                <span>Error: {error?.message ?? "Algo salió mal"}</span>
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
          <div className="border-t border-border p-3">
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
                className="flex-1 bg-muted rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isLoading}
                className="h-9 w-9 p-0"
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
