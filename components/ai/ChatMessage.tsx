'use client';

import type { UIMessage } from 'ai';
import { isToolUIPart } from 'ai';

import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: UIMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  // Extract text content from message parts
  const textContent =
    message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('') || '';

  // Check for tool invocation parts
  const toolParts = message.parts.filter((part) => isToolUIPart(part));

  return (
    <div
      className={cn(
        'mb-2 flex w-full',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-[20px] px-4 py-2.5 text-[15px] leading-snug',
          isUser
            ? 'rounded-br-[6px] bg-foreground text-background'
            : 'rounded-bl-[6px] bg-surface-2 text-foreground',
        )}
      >
        {textContent && (
          <p className="whitespace-pre-wrap break-words">{textContent}</p>
        )}

        {toolParts.length > 0 && (
          <div className={cn('space-y-1', textContent && 'mt-2')}>
            {toolParts.map((part) => {
              if (!isToolUIPart(part)) return null;

              if (part.state === 'output-available') {
                const result = part.output as Record<string, unknown>;
                if (result.success === true && result.message) {
                  return (
                    <div
                      key={part.toolCallId}
                      className="rounded-[10px] bg-positive/10 px-2.5 py-1.5 text-[13px] font-medium text-positive"
                    >
                      {String(result.message)}
                    </div>
                  );
                }
                if (result.success === false && result.message) {
                  return (
                    <div
                      key={part.toolCallId}
                      className="rounded-[10px] bg-negative/10 px-2.5 py-1.5 text-[13px] font-medium text-negative"
                    >
                      {String(result.message)}
                    </div>
                  );
                }
              }

              if (part.state === 'output-error') {
                return (
                  <div
                    key={part.toolCallId}
                    className="rounded-[10px] bg-negative/10 px-2.5 py-1.5 text-[13px] font-medium text-negative"
                  >
                    Error al ejecutar herramienta.
                  </div>
                );
              }

              if (
                part.state === 'input-available' ||
                part.state === 'input-streaming'
              ) {
                return (
                  <div key={part.toolCallId} className="text-[13px] text-faint">
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
