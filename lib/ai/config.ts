import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  MODELS,
  PRIMARY_MODEL_ID,
  FALLBACK_MODEL_ID,
  CHAT_PRIMARY_MODEL_ID,
  CHAT_FALLBACK_MODEL_ID,
  type ModelKey,
} from "@/lib/ai/models";

/**
 * OpenRouter client for Vercel AI SDK.
 * Uses OPENROUTER_API_KEY env var.
 */
export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export {
  MODELS,
  PRIMARY_MODEL_ID,
  FALLBACK_MODEL_ID,
  CHAT_PRIMARY_MODEL_ID,
  CHAT_FALLBACK_MODEL_ID,
  type ModelKey,
};

/**
 * Get the primary AI model instance.
 * To switch: edit PRIMARY_MODEL_ID at the top of lib/ai/models.ts,
 * or change directly to e.g. MODELS.deepseek_r1.id.
 */
export function getModel() {
  return openrouter(PRIMARY_MODEL_ID);
}

/**
 * Get the fallback AI model instance.
 * To switch: edit FALLBACK_MODEL_ID at the top of lib/ai/models.ts,
 * or change directly to e.g. MODELS.gemma_27b.id.
 */
export function getFallbackModel() {
  return openrouter(FALLBACK_MODEL_ID);
}

/**
 * Get the primary tool-capable model for chat route.
 */
export function getChatModel() {
  return openrouter(CHAT_PRIMARY_MODEL_ID);
}

/**
 * Get the fallback tool-capable model for chat route.
 */
export function getChatFallbackModel() {
  return openrouter(CHAT_FALLBACK_MODEL_ID);
}
