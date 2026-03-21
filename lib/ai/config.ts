import { createOpenRouter } from "@openrouter/ai-sdk-provider";

/**
 * OpenRouter client for Vercel AI SDK.
 * Uses OPENROUTER_API_KEY env var.
 */
export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

/** Primary free model */
export const PRIMARY_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

/** Fallback free model */
export const FALLBACK_MODEL = "google/gemma-3-27b-it:free";

/**
 * Get the primary AI model instance.
 */
export function getModel() {
  return openrouter(PRIMARY_MODEL);
}

/**
 * Get the fallback AI model instance.
 */
export function getFallbackModel() {
  return openrouter(FALLBACK_MODEL);
}
