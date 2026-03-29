"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, AlertCircle, DollarSign, Wand2 } from "lucide-react";
import { PaidFallbackDialog } from "./PaidFallbackDialog";

type QuickEntryStatus = "idle" | "loading" | "needs-confirmation" | "error";

interface FallbackError {
  requiresConfirmation: boolean;
  fallbackModel: string;
  estimatedCost: string;
  freeProviderErrors: string[];
}

export function QuickEntryBar() {
  const { data: session } = useSession();
  const router = useRouter();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<QuickEntryStatus>("idle");
  const [message, setMessage] = useState("");
  const [fallbackError, setFallbackError] = useState<FallbackError | null>(null);

  if (!session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = text.trim();
    if (!trimmed) return;

    setStatus("loading");
    setMessage("");
    setFallbackError(null);

    try {
      const response = await fetch("/api/ai/parse-for-form", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
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
          if (value !== undefined && value !== null && value !== "") {
            queryParams.set(key, String(value));
          }
        });
        
        // Add original text and AI metadata
        queryParams.set("ai_text", trimmed);
        queryParams.set("ai_provider", data.providerUsed || "unknown");
        queryParams.set("ai_model", data.modelUsed || "unknown");
        if (data.isPaidFallback) {
          queryParams.set("ai_cost", String(data.costUsd || 0));
        }
        
        // Redirect to /new with parsed data
        router.push(`/new?${queryParams.toString()}`);
        
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
    } catch (error) {
      console.error("Parse error:", error);
      setStatus("error");
      setMessage("Error de conexión.");
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  // Handle paid fallback confirmation
  const handleConfirmPaidFallback = async () => {
    if (!fallbackError || !text.trim()) return;

    setFallbackError(null);
    setStatus("loading");

    try {
      const response = await fetch("/api/ai/parse-for-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          if (value !== undefined && value !== null && value !== "") {
            queryParams.set(key, String(value));
          }
        });
        
        queryParams.set("ai_text", text.trim());
        queryParams.set("ai_provider", data.providerUsed || "opencode");
        queryParams.set("ai_model", data.modelUsed || "kimi-k2.5");
        queryParams.set("ai_cost", String(data.costUsd || 0));
        queryParams.set("ai_paid", "true");
        
        router.push(`/new?${queryParams.toString()}`);
      } else {
        setStatus("error");
        setMessage(data.error || "Error al procesar con modelo de pago.");
        setTimeout(() => setStatus("idle"), 4000);
      }
    } catch (error) {
      console.error("Paid fallback error:", error);
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
            placeholder='Ej: "1000€ iPhone ayer con tarjeta"'
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
            <>
              <Wand2 className="h-4 w-4 mr-1" />
              IA
            </>
          )}
        </Button>
      </form>

      {status === "error" && message && (
        <div className="mt-2 text-sm flex items-center gap-1.5 text-red-700 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5" />
          {message}
        </div>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        Escribe una descripción natural y te llevaremos al formulario con los datos pre-rellenos
      </p>
    </div>
  );
}
