import { createGroq } from "@ai-sdk/groq";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// Validate required environment variables at module load time
function validateEnvVars() {
  const provider = (process.env.AI_PROVIDER ?? "groq") as "groq" | "openrouter" | "opencode";
  
  const errors: string[] = [];
  
  switch (provider) {
    case "groq":
      if (!process.env.GROQ_API_KEY) {
        errors.push("GROQ_API_KEY environment variable is required when AI_PROVIDER=groq");
      }
      break;
    case "openrouter":
      if (!process.env.OPENROUTER_API_KEY) {
        errors.push("OPENROUTER_API_KEY environment variable is required when AI_PROVIDER=openrouter");
      }
      break;
    case "opencode":
      if (!process.env.OPENCODE_API_KEY) {
        errors.push("OPENCODE_API_KEY environment variable is required when AI_PROVIDER=opencode");
      }
      break;
    default:
      errors.push(`Invalid AI_PROVIDER: ${provider}. Must be one of: groq, openrouter, opencode`);
  }
  
  if (errors.length > 0) {
    console.error("[AI Config Error]", errors.join("\n"));
    throw new Error(`AI Provider configuration error:\n${errors.join("\n")}`);
  }
  
  return provider;
}

const PROVIDER = validateEnvVars();

// Initialize providers with validated API keys
const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY!,
});

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

// Opencode Zen provider - uses OpenAI-compatible API
// Correct endpoint for Big Pickle and Kimi K2.5 models
const opencode = createOpenAICompatible({
  name: "opencode",
  apiKey: process.env.OPENCODE_API_KEY!,
  baseURL: "https://opencode.ai/zen/v1",
});

// Model configurations by provider
const MODELS: Record<typeof PROVIDER, string> = {
  groq: "llama-3.3-70b-versatile",
  openrouter: "meta-llama/llama-3.3-70b-instruct:free",
  opencode: "big-pickle", // Default to free Big Pickle model
};

// Provider-specific model mapping with tier information
export const OPENCODE_MODELS = {
  // Free tier models
  big_pickle: {
    id: "big-pickle",
    name: "Big Pickle",
    tier: "free" as const,
    description: "Free general-purpose model with good performance for most tasks",
  },
  // Paid tier models
  kimi_k2_5: {
    id: "kimi-k2.5",
    name: "Kimi K2.5",
    tier: "paid" as const,
    description: "High-performance model for complex tasks (paid option)",
  },
};

// Helper to get the appropriate model based on provider and optional model override
export function getModel(provider: typeof PROVIDER, modelId?: string) {
  switch (provider) {
    case "groq":
      return groq(modelId || MODELS.groq);
    case "openrouter":
      return openrouter(modelId || MODELS.openrouter);
    case "opencode":
      // For Opencode, allow selecting specific models
      const opencodeModelId = modelId || MODELS.opencode;
      return opencode(opencodeModelId);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// Default model export (maintains backward compatibility)
export const aiModel = getModel(PROVIDER);

// Exports
export const AI_PROVIDER = PROVIDER;
export const AI_MODEL_NAME = MODELS[PROVIDER];
export { groq, openrouter, opencode };
