import { createGroq } from '@ai-sdk/groq';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';

import { logger } from '@/lib/logger';

// Initialize all providers (some may be missing API keys, that's ok)
const groq = process.env.GROQ_API_KEY
  ? createGroq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const openrouter = process.env.OPENROUTER_API_KEY
  ? createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
  : null;

const opencode = process.env.OPENCODE_API_KEY
  ? createOpenAICompatible({
      name: 'opencode',
      apiKey: process.env.OPENCODE_API_KEY,
      baseURL: 'https://opencode.ai/zen/v1',
    })
  : null;

export interface FreeModelConfig {
  provider: 'groq' | 'openrouter' | 'opencode';
  modelId: string;
  name: string;
  timeoutMs: number;
  /**
   * True when the model accepts image parts. Verified against
   * `~/.cache/opencode/models.json` `modalities.input` for the opencode
   * entries and against each provider's model card for the others.
   *
   * `big-pickle` is deliberately first — it is the preferred free model —
   * and deliberately NOT flagged: it is text-only, so it can never be
   * selected for a receipt.
   */
  requiresVision?: boolean;
}

/**
 * Free model configurations, in preference order.
 *
 * `raceFreeProviders` awaits every model and then takes the first success in
 * this order, so index 0 is the preferred model for text work and the first
 * `requiresVision` entry is preferred for images. Vision timeouts are larger
 * because a model has to encode the image before it can answer.
 */
export const FREE_MODELS: FreeModelConfig[] = [
  {
    provider: 'opencode',
    modelId: 'big-pickle',
    name: 'Big Pickle (Opencode Zen Free)',
    timeoutMs: 10000,
  },
  {
    provider: 'opencode',
    modelId: 'mimo-v2.5-free',
    name: 'MiMo V2.5 (Opencode Zen Free Vision)',
    timeoutMs: 25000,
    requiresVision: true,
  },
  {
    provider: 'groq',
    modelId: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B (Groq)',
    timeoutMs: 8000,
  },
  {
    provider: 'groq',
    modelId: 'gemma2-9b-it',
    name: 'Gemma 2 9B (Groq)',
    timeoutMs: 6000,
  },
  {
    provider: 'groq',
    modelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout 17B (Groq Vision)',
    timeoutMs: 25000,
    requiresVision: true,
  },
  {
    provider: 'openrouter',
    modelId: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B (OpenRouter Free)',
    timeoutMs: 10000,
  },
  {
    provider: 'openrouter',
    modelId: 'google/gemma-3-27b-it:free',
    name: 'Gemma 3 27B (OpenRouter Free)',
    timeoutMs: 8000,
  },
  {
    provider: 'openrouter',
    modelId: 'openrouter/free',
    name: 'Auto-Router (OpenRouter Free)',
    timeoutMs: 25000,
    requiresVision: true,
  },
];

// Paid fallback model
export const PAID_FALLBACK = {
  provider: 'opencode' as const,
  modelId: 'kimi-k2.5',
  name: 'Kimi K2.5 (Opencode Zen Paid)',
  costPer1MInput: 0.6,
  costPer1MOutput: 3.0,
  timeoutMs: 15000,
};

// Cost tracking storage (in-memory, persists for session)
interface CostEntry {
  timestamp: Date;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  endpoint: string;
}

const costHistory: CostEntry[] = [];

function trackCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  endpoint: string,
): void {
  const cost = calculateCost(provider, model, inputTokens, outputTokens);

  const entry: CostEntry = {
    timestamp: new Date(),
    provider,
    model,
    inputTokens,
    outputTokens,
    costUsd: cost,
    endpoint,
  };

  costHistory.push(entry);

  logger.info(
    `[Cost Tracker] ${provider}/${model}: $${cost.toFixed(6)} (${inputTokens} in, ${outputTokens} out)`,
  );
}

function calculateCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  // Only paid models cost money
  if (provider === 'opencode' && model === 'kimi-k2.5') {
    const inputCost = (inputTokens / 1_000_000) * PAID_FALLBACK.costPer1MInput;
    const outputCost =
      (outputTokens / 1_000_000) * PAID_FALLBACK.costPer1MOutput;
    return inputCost + outputCost;
  }

  // All other models are free
  return 0;
}

export function getTotalSpent(): number {
  return costHistory.reduce((sum, entry) => sum + entry.costUsd, 0);
}

export function getCostBreakdown(): { free: number; paid: number } {
  return costHistory.reduce(
    (acc, entry) => {
      if (entry.costUsd === 0) {
        acc.free++;
      } else {
        acc.paid += entry.costUsd;
      }
      return acc;
    },
    { free: 0, paid: 0 },
  );
}

export function getRecentCosts(limit: number = 10): CostEntry[] {
  return [...costHistory].reverse().slice(0, limit);
}

/**
 * The models eligible for a request, before the "is this provider
 * configured" filter. Pure, so the modality rules are testable without
 * any API keys present.
 */
export function selectFreeModels(visionOnly: boolean): FreeModelConfig[] {
  if (!visionOnly) return FREE_MODELS;
  return FREE_MODELS.filter((config) => config.requiresVision === true);
}

// Get available free models based on configured providers
function getAvailableFreeModels(visionOnly: boolean): FreeModelConfig[] {
  return selectFreeModels(visionOnly).filter((config) => {
    switch (config.provider) {
      case 'groq':
        return groq !== null;
      case 'openrouter':
        return openrouter !== null;
      case 'opencode':
        return opencode !== null;
      default:
        return false;
    }
  });
}

// Check if paid fallback is available
export function isPaidFallbackAvailable(): boolean {
  return opencode !== null;
}

// Create model instance
function createModel(
  provider: FreeModelConfig['provider'],
  modelId: string,
): LanguageModel | null {
  switch (provider) {
    case 'groq':
      return groq?.(modelId) ?? null;
    case 'openrouter':
      return openrouter?.(modelId) ?? null;
    case 'opencode':
      return opencode?.(modelId) ?? null;
    default:
      return null;
  }
}

// Race multiple free providers and return first success
// Returns both the result and token usage for accurate cost tracking
export async function raceFreeProviders<T>(
  operation: (
    model: LanguageModel,
    config: (typeof FREE_MODELS)[number],
  ) => Promise<{
    result: T;
    usage?: { inputTokens?: number; outputTokens?: number };
  }>,
  options: {
    timeoutMs?: number;
    endpoint?: string;
    visionOnly?: boolean;
  } = {},
): Promise<
  | {
      success: true;
      result: T;
      provider: string;
      model: string;
      costUsd: number;
      inputTokens: number;
      outputTokens: number;
    }
  | { success: false; error: string; attempts: string[] }
> {
  const availableModels = getAvailableFreeModels(options.visionOnly === true);

  if (availableModels.length === 0) {
    return {
      success: false,
      error:
        'No hay proveedores gratuitos configurados. Configure GROQ_API_KEY, OPENROUTER_API_KEY u OPENCODE_API_KEY.',
      attempts: [],
    };
  }

  const attempts: string[] = [];

  // Create promises for each provider with individual timeouts
  const promises = availableModels.map(async (config) => {
    const startTime = Date.now();

    try {
      const model = createModel(config.provider, config.modelId);

      if (!model) {
        attempts.push(`${config.name}: Proveedor no inicializado`);
        return null;
      }

      // Create timeout promise. The handle is kept so the timer can be
      // cancelled as soon as the race settles: a fast model must not leave
      // an armed timer behind (Jest would then warn about open handles and
      // the process would linger for the full timeout).
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              `Tiempo de espera agotado después de ${config.timeoutMs}ms`,
            ),
          );
        }, config.timeoutMs);
      });

      // Race between operation and timeout
      const { result, usage } = await Promise.race([
        operation(model, config),
        timeoutPromise,
      ]).finally(() => {
        if (timer !== undefined) clearTimeout(timer);
      });

      const duration = Date.now() - startTime;
      const inputTokens = usage?.inputTokens ?? 0;
      const outputTokens = usage?.outputTokens ?? 0;

      logger.info(
        `[AI Provider] Éxito: ${config.name} en ${duration}ms (${inputTokens} in, ${outputTokens} out)`,
      );

      // Track cost (free models = $0, but still track for analytics)
      trackCost(
        config.provider,
        config.modelId,
        inputTokens,
        outputTokens,
        options.endpoint ?? 'unknown',
      );

      return {
        result,
        provider: config.provider,
        model: config.modelId,
        costUsd: 0,
        inputTokens,
        outputTokens,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Error desconocido';
      attempts.push(`${config.name}: ${errorMsg}`);
      console.warn(`[AI Provider] Falló: ${config.name} - ${errorMsg}`);
      return null;
    }
  });

  // Wait for all promises, collect results
  const results = await Promise.all(promises);

  // Find first successful result
  const success = results.find((r): r is NonNullable<typeof r> => r !== null);

  if (success) {
    return {
      success: true,
      result: success.result,
      provider: success.provider,
      model: success.model,
      costUsd: success.costUsd,
      inputTokens: success.inputTokens,
      outputTokens: success.outputTokens,
    };
  }

  // All free providers failed
  return {
    success: false,
    error: 'Todos los proveedores gratuitos fallaron',
    attempts,
  };
}

// Execute paid fallback with cost tracking
// Returns both the result and actual cost based on token usage
export async function executePaidFallback<T>(
  operation: (model: LanguageModel) => Promise<{
    result: T;
    usage?: { inputTokens?: number; outputTokens?: number };
  }>,
  options: {
    endpoint?: string;
  } = {},
): Promise<
  | {
      success: true;
      result: T;
      costUsd: number;
      inputTokens: number;
      outputTokens: number;
    }
  | { success: false; error: string }
> {
  if (!isPaidFallbackAvailable()) {
    return {
      success: false,
      error:
        'El respaldo pago (Kimi K2.5) no está disponible. Configure OPENCODE_API_KEY.',
    };
  }

  try {
    const model = createModel(PAID_FALLBACK.provider, PAID_FALLBACK.modelId);

    if (!model) {
      return {
        success: false,
        error: 'Error al inicializar el modelo de pago',
      };
    }

    const startTime = Date.now();
    const { result, usage } = await operation(model);
    const duration = Date.now() - startTime;

    // Get actual token counts from usage or fallback to estimates
    const inputTokens = usage?.inputTokens ?? 1000;
    const outputTokens = usage?.outputTokens ?? 500;

    // Calculate and track cost
    const costUsd = calculateCost(
      PAID_FALLBACK.provider,
      PAID_FALLBACK.modelId,
      inputTokens,
      outputTokens,
    );
    trackCost(
      PAID_FALLBACK.provider,
      PAID_FALLBACK.modelId,
      inputTokens,
      outputTokens,
      options.endpoint ?? 'unknown',
    );

    logger.info(
      `[AI Provider] Respaldo pago usado: ${PAID_FALLBACK.name} en ${duration}ms, costo: $${costUsd.toFixed(6)} (${inputTokens} in, ${outputTokens} out)`,
    );

    return {
      success: true,
      result,
      costUsd,
      inputTokens,
      outputTokens,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : 'Error desconocido';
    console.error(`[AI Provider] Respaldo pago falló: ${errorMsg}`);

    return {
      success: false,
      error: `Respaldo pago falló: ${errorMsg}`,
    };
  }
}
