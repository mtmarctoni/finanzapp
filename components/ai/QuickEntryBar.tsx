"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, Check, AlertCircle } from "lucide-react";

type QuickEntryStatus = "idle" | "loading" | "success" | "error";

export function QuickEntryBar() {
  const { data: session } = useSession();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<QuickEntryStatus>("idle");
  const [message, setMessage] = useState("");

  if (!session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = text.trim();
    if (!trimmed) return;

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/ai/parse-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus("success");
        setMessage(
          `${data.entry.accion}: ${data.entry.cantidad}\u20AC - ${data.entry.que} (${data.entry.tipo})`
        );
        setText("");
        setTimeout(() => {
          setStatus("idle");
          setMessage("");
        }, 4000);
      } else {
        setStatus("error");
        setMessage(data.error || "Error al procesar.");
        setTimeout(() => setStatus("idle"), 4000);
      }
    } catch {
      setStatus("error");
      setMessage("Error de conexi\u00F3n.");
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder='Ej: "12\u20AC comida en El Camino con tarjeta"'
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
            "A\u00F1adir"
          )}
        </Button>
      </form>

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
