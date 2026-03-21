import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  FREE_MODELS,
  PRIMARY_MODEL_ID,
  FALLBACK_MODEL_ID,
} from "@/lib/ai/models";

/**
 * OpenRouter client for Vercel AI SDK.
 * Uses OPENROUTER_API_KEY env var.
 */
export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

/**
 * Get the primary AI model instance.
 * Change PRIMARY_MODEL_ID in lib/ai/models.ts to switch models.
 */
export function getModel() {
  return openrouter(PRIMARY_MODEL_ID);
}

/**
 * Get the fallback AI model instance.
 * Change FALLBACK_MODEL_ID in lib/ai/models.ts to switch models.
 */
export function getFallbackModel() {
  return openrouter(FALLBACK_MODEL_ID);
}
