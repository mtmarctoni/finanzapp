"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, Check, AlertCircle, DollarSign } from "lucide-react";
import { PaidFallbackDialog } from "./PaidFallbackDialog";

type QuickEntryStatus = "idle" | "loading" | "success" | "error" | "needs-confirmation";

interface FallbackError {
  requiresConfirmation: boolean;
  fallbackModel: string;
  estimatedCost: string;
  freeProviderErrors: string[];
}

export function QuickEntryBar() {
  const { data: session } = useSession();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<QuickEntryStatus>("idle");
  const [message, setMessage] = useState("");
  const [fallbackError, setFallbackError] = useState<FallbackError | null>(null);
  const [paidSessionActive, setPaidSessionActive] = useState(false);

  if (!session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = text.trim();
    if (!trimmed) return;

    setStatus("loading");
    setMessage("");
    setFallbackError(null);

    try {
      const response = await fetch("/api/ai/parse-entry", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(paidSessionActive && { "X-Confirm-Paid": "true" }),
        },
        body: JSON.stringify({ 
          text: trimmed,
          confirmPaidFallback: paidSessionActive,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus("success");
        setMessage(
          `${data.entry.accion}: ${data.entry.cantidad}€ - ${data.entry.que} (${data.entry.tipo})`
        );
        
        // Show cost if using paid fallback
        if (data.isPaidFallback && data.costUsd) {
          setMessage(prev => `${prev} (cost: $${data.costUsd.toFixed(4)})`);
        }
        
        setText("");
        setTimeout(() => {
          setStatus("idle");
          setMessage("");
        }, 4000);
      } else if (data.requiresConfirmation) {
        // Need paid fallback confirmation
        setStatus("needs-confirmation");
        setFallbackError({
          requiresConfirmation: true,
          fallbackModel: data.fallbackModel,
          estimatedCost: data.estimatedCost,
          freeProviderErrors: data.freeProviderErrors || [],
        });
      } else {
        setStatus("error");
        setMessage(data.error || "Error al procesar.");
        setTimeout(() => setStatus("idle"), 4000);
      }
    } catch {
      setStatus("error");
      setMessage("Error de conexión.");
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  // Handle paid fallback confirmation
  const handleConfirmPaidFallback = async () => {
    if (!fallbackError) return;

    setPaidSessionActive(true);
    setFallbackError(null);
    
    // Retry the request
    const trimmed = text.trim();
    if (!trimmed) {
      setStatus("idle");
      return;
    }

    setStatus("loading");

    try {
      const response = await fetch("/api/ai/parse-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: trimmed,
          confirmPaidFallback: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus("success");
        const costMsg = data.isPaidFallback && data.costUsd 
          ? ` (cost: $${data.costUsd.toFixed(4)})` 
          : "";
        setMessage(
          `${data.entry.accion}: ${data.entry.cantidad}€ - ${data.entry.que} (${data.entry.tipo})${costMsg}`
        );
        setText("");
        setTimeout(() => {
          setStatus("idle");
          setMessage("");
        }, 5000);
      } else {
        setStatus("error");
        setMessage(data.error || "Error al procesar con modelo de pago.");
        setTimeout(() => setStatus("idle"), 4000);
      }
    } catch {
      setStatus("error");
      setMessage("Error de conexión.");
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  const handleDeclinePaidFallback = () => {
    setFallbackError(null);
    setStatus("idle");
  };

  return (
    <div className="w-full">
      {/* Paid Fallback Dialog */}
      <PaidFallbackDialog
        isOpen={!!fallbackError}
        onClose={handleDeclinePaidFallback}
        onConfirm={handleConfirmPaidFallback}
        onDecline={handleDeclinePaidFallback}
        estimatedCost={fallbackError?.estimatedCost || "$0.001 - $0.005"}
        modelName={fallbackError?.fallbackModel || "Kimi K2.5"}
      />

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder='Ej: "12€ comida en El Camino con tarjeta"'
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={status === "loading"}
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={status === "loading" || !text.trim()}>
          {status === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Añadir"
          )}
        </Button>
      </form>

      {paidSessionActive && (
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            Using paid model for this session
          </span>
          <button
            onClick={() => setPaidSessionActive(false)}
            className="text-muted-foreground underline hover:no-underline"
          >
            Disable
          </button>
        </div>
      )}

      {message && (
        <div
          className={`mt-2 text-sm flex items-center gap-1.5 ${
            status === "success"
              ? "text-green-700 dark:text-green-400"
              : "text-red-700 dark:text-red-400"
          }`}
        >
          {status === "success" ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5" />
          )}
          {message}
        </div>
      )}
    </div>
  );
}
