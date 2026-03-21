import { createGroq } from '@ai-sdk/groq'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY!,
})

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
})

const PROVIDER = (process.env.AI_PROVIDER ?? 'groq') as 'groq' | 'openrouter'

const MODELS: Record<'groq' | 'openrouter', string> = {
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
}

export const aiModel =
  PROVIDER === 'openrouter'
    ? openrouter(MODELS.openrouter)
    : groq(MODELS.groq)

export const AI_PROVIDER = PROVIDER
export const AI_MODEL_NAME = MODELS[PROVIDER]
