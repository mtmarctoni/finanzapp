export const MODELS = {
  mistral_small: {
    id: "mistralai/mistral-small-3.1-24b-instruct:free",
    description:
      "Best all-around free model. Fast, reliable, excellent tool use.",
  },
  nemotron_super: {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    description:
      "120B MoE model. Excellent for complex multi-agent tasks, longest context (262K).",
  },
  stepfun_flash: {
    id: "stepfun/step-3.5-flash:free",
    description: "StepFun flagship. Strong reasoning, 256K context, fast.",
  },
  qwen3_next: {
    id: "qwen/qwen3-next-80b-a3b-instruct:free",
    description:
      "Qwen latest. Great reasoning, 262K context, strong tool calling.",
  },
  qwen3_coder: {
    id: "qwen/qwen3-coder:free",
    description:
      "Best free coding model on OpenRouter. 262K context. Also good for structured output.",
  },
  gpt_oss_120b: {
    id: "openai/gpt-oss-120b:free",
    description: "OpenAI open-weight 120B MoE. Fast, optimized, good tool use.",
  },
  glm_45_air: {
    id: "z-ai/glm-4.5-air:free",
    description: "Best balance of intelligence, speed, and tool discipline.",
  },
  minimax_m2: {
    id: "minimax/minimax-m2.5:free",
    description:
      "MiniMax M2.5. 197K context, strong general-purpose performance.",
  },
  nemotron_nano: {
    id: "nvidia/nemotron-3-nano-30b-a3b:free",
    description:
      "NVIDIA compact MoE. 256K context, efficient, good for agents.",
  },
  llama_70b: {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    description:
      "Meta flagship. GPT-4 level performance, 65K context, reliable.",
  },
  deepseek_r1: {
    id: "deepseek/deepseek-r1:free",
    description:
      "DeepSeek R1. Strong reasoning, great for complex analysis tasks.",
  },
  gemma_27b: {
    id: "google/gemma-3-27b-it:free",
    description:
      "Google Gemma 3 27B. Fast, good general purpose, supports vision.",
  },
  gpt_oss_20b: {
    id: "openai/gpt-oss-20b:free",
    description:
      "Lightweight 20B MoE. Very fast, lower memory, good for simple tasks.",
  },
  trinity: {
    id: "arcee-ai/trinity-large-preview:free",
    description: "Arcee Trinity. General purpose, 131K context.",
  },
  openrouter_free: {
    id: "openrouter/free",
    description: "OpenRouter auto-router. Picks the best free model for your request. Handles tool use, vision, etc.",
  },
  // Opencode Zen Models
  big_pickle: {
    id: "big-pickle",
    provider: "opencode",
    tier: "free",
    description: "Free general-purpose model. Good for everyday finance tasks.",
  },
  kimi_2_5: {
    id: "kimi-k2.5",
    provider: "opencode",
    tier: "paid",
    description: "High-performance model for complex analysis and reasoning tasks.",
  },
} as const;

export type ModelKey = keyof typeof MODELS;

// Model selection by provider
export const PROVIDER_MODELS = {
  groq: {
    primary: MODELS.llama_70b.id,
    fallback: MODELS.gemma_27b.id,
  },
  openrouter: {
    primary: MODELS.gemma_27b.id,
    fallback: MODELS.openrouter_free.id,
  },
  opencode: {
    primary: MODELS.big_pickle.id,
    fallback: MODELS.kimi_2_5.id,
  },
} as const;

// Helper to get primary model based on provider
export function getPrimaryModelId(provider: "groq" | "openrouter" | "opencode"): string {
  return PROVIDER_MODELS[provider].primary;
}

// Helper to get fallback model based on provider
export function getFallbackModelId(provider: "groq" | "openrouter" | "opencode"): string {
  return PROVIDER_MODELS[provider].fallback;
}

export const PRIMARY_MODEL_ID = MODELS.gemma_27b.id;
export const FALLBACK_MODEL_ID = MODELS.openrouter_free.id;

// Chat route uses tools/function-calling, so keep these on tool-capable models.
export const CHAT_PRIMARY_MODEL_ID = MODELS.mistral_small.id;
export const CHAT_FALLBACK_MODEL_ID = MODELS.qwen3_next.id;
