import { createGroq } from "@ai-sdk/groq";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

// Initialize all providers (some may be missing API keys, that's ok)
const groq = process.env.GROQ_API_KEY 
  ? createGroq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const openrouter = process.env.OPENROUTER_API_KEY
  ? createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
  : null;

const opencode = process.env.OPENCODE_API_KEY
  ? createOpenAICompatible({
      name: "opencode",
      apiKey: process.env.OPENCODE_API_KEY,
      baseURL: "https://opencode.ai/zen/v1",
    })
  : null;

// Free model configurations by provider
export const FREE_MODELS = [
  {
    provider: "groq" as const,
    modelId: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B (Groq)",
    timeoutMs: 8000,
  },
  {
    provider: "groq" as const,
    modelId: "gemma2-9b-it",
    name: "Gemma 2 9B (Groq)",
    timeoutMs: 6000,
  },
  {
    provider: "openrouter" as const,
    modelId: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B (OpenRouter Free)",
    timeoutMs: 10000,
  },
  {
    provider: "openrouter" as const,
    modelId: "google/gemma-3-27b-it:free",
    name: "Gemma 3 27B (OpenRouter Free)",
    timeoutMs: 8000,
  },
  {
    provider: "openrouter" as const,
    modelId: "openrouter/free",
    name: "Auto-Router (OpenRouter Free)",
    timeoutMs: 12000,
  },
  {
    provider: "opencode" as const,
    modelId: "big-pickle",
    name: "Big Pickle (Opencode Zen Free)",
    timeoutMs: 10000,
  },
];

// Paid fallback model
export const PAID_FALLBACK = {
  provider: "opencode" as const,
  modelId: "kimi-k2.5",
  name: "Kimi K2.5 (Opencode Zen Paid)",
  costPer1MInput: 0.60,
  costPer1MOutput: 3.00,
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

export function trackCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  endpoint: string
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
  
  console.log(`[Cost Tracker] ${provider}/${model}: $${cost.toFixed(6)} (${inputTokens} in, ${outputTokens} out)`);
}

export function calculateCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  // Only paid models cost money
  if (provider === "opencode" && model === "kimi-k2.5") {
    const inputCost = (inputTokens / 1_000_000) * PAID_FALLBACK.costPer1MInput;
    const outputCost = (outputTokens / 1_000_000) * PAID_FALLBACK.costPer1MOutput;
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
    { free: 0, paid: 0 }
  );
}

export function getRecentCosts(limit: number = 10): CostEntry[] {
  return [...costHistory].reverse().slice(0, limit);
}

// Get available free models based on configured providers
export function getAvailableFreeModels(): typeof FREE_MODELS {
  return FREE_MODELS.filter((config) => {
    switch (config.provider) {
      case "groq":
        return groq !== null;
      case "openrouter":
        return openrouter !== null;
      case "opencode":
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
export function createModel(
  provider: typeof FREE_MODELS[number]["provider"],
  modelId: string
): LanguageModel | null {
  switch (provider) {
    case "groq":
      return groq?.(modelId) ?? null;
    case "openrouter":
      return openrouter?.(modelId) ?? null;
    case "opencode":
      return opencode?.(modelId) ?? null;
    default:
      return null;
  }
}

// Race multiple free providers and return first success
export async function raceFreeProviders<T>(
  operation: (model: LanguageModel, config: typeof FREE_MODELS[number]) => Promise<T>,
  options: {
    timeoutMs?: number;
    endpoint?: string;
  } = {}
): Promise<
  | { success: true; result: T; provider: string; model: string; costUsd: number }
  | { success: false; error: string; attempts: string[] }
> {
  const availableModels = getAvailableFreeModels();
  
  if (availableModels.length === 0) {
    return {
      success: false,
      error: "No free providers configured. Please set GROQ_API_KEY, OPENROUTER_API_KEY, or OPENCODE_API_KEY.",
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
        attempts.push(`${config.name}: Provider not initialized`);
        return null;
      }
      
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Timeout after ${config.timeoutMs}ms`));
        }, config.timeoutMs);
      });
      
      // Race between operation and timeout
      const result = await Promise.race([
        operation(model, config),
        timeoutPromise,
      ]);
      
      const duration = Date.now() - startTime;
      
      console.log(`[AI Provider] Success: ${config.name} in ${duration}ms`);
      
      // Track cost (free models = $0)
      trackCost(config.provider, config.modelId, 0, 0, options.endpoint || "unknown");
      
      return {
        result,
        provider: config.provider,
        model: config.modelId,
        costUsd: 0,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      attempts.push(`${config.name}: ${errorMsg}`);
      console.warn(`[AI Provider] Failed: ${config.name} - ${errorMsg}`);
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
    };
  }
  
  // All free providers failed
  return {
    success: false,
    error: "All free providers failed",
    attempts,
  };
}

// Execute paid fallback with cost tracking
export async function executePaidFallback<T>(
  operation: (model: LanguageModel) => Promise<{ result: T; inputTokens?: number; outputTokens?: number }>,
  options: {
    endpoint?: string;
  } = {}
): Promise<
  | { success: true; result: T; costUsd: number }
  | { success: false; error: string }
> {
  if (!isPaidFallbackAvailable()) {
    return {
      success: false,
      error: "Paid fallback (Kimi K2.5) not available. Please set OPENCODE_API_KEY.",
    };
  }
  
  try {
    const model = createModel(PAID_FALLBACK.provider, PAID_FALLBACK.modelId);
    
    if (!model) {
      return {
        success: false,
        error: "Failed to initialize paid model",
      };
    }
    
    const startTime = Date.now();
    const { result, inputTokens = 1000, outputTokens = 500 } = await operation(model);
    const duration = Date.now() - startTime;
    
    // Calculate and track cost
    const costUsd = calculateCost(PAID_FALLBACK.provider, PAID_FALLBACK.modelId, inputTokens, outputTokens);
    trackCost(PAID_FALLBACK.provider, PAID_FALLBACK.modelId, inputTokens, outputTokens, options.endpoint || "unknown");
    
    console.log(`[AI Provider] Paid fallback used: ${PAID_FALLBACK.name} in ${duration}ms, cost: $${costUsd.toFixed(6)}`);
    
    return {
      success: true,
      result,
      costUsd,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[AI Provider] Paid fallback failed: ${errorMsg}`);
    
    return {
      success: false,
      error: `Paid fallback failed: ${errorMsg}`,
    };
  }
}

// Export providers for direct use if needed
export { groq, openrouter, opencode };
