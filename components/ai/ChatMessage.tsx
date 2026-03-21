"use client";

import type { UIMessage } from "ai";
import { isToolUIPart } from "ai";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: UIMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  // Extract text content from message parts
  const textContent = message.parts
    ?.filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("") || "";

  // Check for tool invocation parts
  const toolParts = message.parts?.filter((part) => isToolUIPart(part)) || [];

  return (
    <div
      className={cn(
        "flex w-full mb-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {textContent && (
          <p className="whitespace-pre-wrap break-words">{textContent}</p>
        )}

        {toolParts.length > 0 && (
          <div className="mt-1 space-y-1">
            {toolParts.map((part) => {
              if (!isToolUIPart(part)) return null;

              if (part.state === "output-available") {
                const result = part.output as Record<string, unknown>;
                if (result?.success === true && result?.message) {
                  return (
                    <div
                      key={part.toolCallId}
                      className="text-xs bg-green-500/10 text-green-700 dark:text-green-400 rounded px-2 py-1"
                    >
                      {String(result.message)}
                    </div>
                  );
                }
                if (result?.success === false && result?.message) {
                  return (
                    <div
                      key={part.toolCallId}
                      className="text-xs bg-red-500/10 text-red-700 dark:text-red-400 rounded px-2 py-1"
                    >
                      {String(result.message)}
                    </div>
                  );
                }
              }

              if (part.state === "output-error") {
                return (
                  <div
                    key={part.toolCallId}
                    className="text-xs bg-red-500/10 text-red-700 dark:text-red-400 rounded px-2 py-1"
                  >
                    Error al ejecutar herramienta.
                  </div>
                );
              }

              if (part.state === "input-available" || part.state === "input-streaming") {
                return (
                  <div
                    key={part.toolCallId}
                    className="text-xs text-muted-foreground/60 italic"
                  >
                    Procesando...
                  </div>
                );
              }

              return null;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
