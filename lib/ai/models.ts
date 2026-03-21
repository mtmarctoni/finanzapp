export interface ModelInfo {
  id: string;
  description: string;
}

export const FREE_MODELS: ModelInfo[] = [
  {
    id: "mistralai/mistral-small-3.1-24b-instruct:free",
    description:
      "Best all-around free model. Fast, reliable, excellent tool use.",
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    description:
      "120B MoE model. Excellent for complex multi-agent tasks, longest context (262K).",
  },
  {
    id: "stepfun/step-3.5-flash:free",
    description:
      "StepFun's flagship. Strong reasoning, 256K context, fast.",
  },
  {
    id: "qwen/qwen3-next-80b-a3b-instruct:free",
    description:
      "Qwen's latest. Great reasoning, 262K context, strong tool calling.",
  },
  {
    id: "qwen/qwen3-coder:free",
    description:
      "Best free coding model on OpenRouter. 262K context. Also good for structured output.",
  },
  {
    id: "openai/gpt-oss-120b:free",
    description:
      "OpenAI's open-weight 120B MoE. Fast, optimized, good tool use.",
  },
  {
    id: "z-ai/glm-4.5-air:free",
    description:
      "GLM 4.5 Air. Best balance of intelligence, speed, and tool discipline.",
  },
  {
    id: "minimax/minimax-m2.5:free",
    description:
      "MiniMax M2.5. 197K context, strong general-purpose performance.",
  },
  {
    id: "nvidia/nemotron-3-nano-30b-a3b:free",
    description:
      "NVIDIA's compact MoE. 256K context, efficient, good for agents.",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    description:
      "Meta's flagship. GPT-4 level performance, 65K context, reliable.",
  },
  {
    id: "openai/gpt-oss-20b:free",
    description:
      "Lightweight 20B MoE. Very fast, lower memory, good for simple tasks.",
  },
  {
    id: "arcee-ai/trinity-large-preview:free",
    description:
      "Arcee Trinity. General purpose, 131K context.",
  },
];

export const PRIMARY_MODEL_ID = FREE_MODELS[0].id;
export const FALLBACK_MODEL_ID = FREE_MODELS[9].id;
