/** @jest-environment node */

describe('free model selection', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    // Only Opencode is configured, so the visible list is exactly the
    // opencode entries and the assertions below cannot be perturbed by
    // a developer who happens to have Groq or OpenRouter keys set.
    process.env.OPENCODE_API_KEY = 'test-key';
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('lists big-pickle as the very first free model', async () => {
    const { FREE_MODELS } = await import('@/lib/ai/fallback');
    expect(FREE_MODELS[0].modelId).toBe('big-pickle');
  });

  it('never marks big-pickle as vision capable', async () => {
    const { FREE_MODELS } = await import('@/lib/ai/fallback');
    const bigPickle = FREE_MODELS.find((m) => m.modelId === 'big-pickle');
    expect(bigPickle?.requiresVision).toBeUndefined();
  });

  it('excludes every text-only model from a vision race', async () => {
    const { selectFreeModels } = await import('@/lib/ai/fallback');
    const vision = selectFreeModels(true);
    expect(vision.length).toBeGreaterThan(0);
    expect(vision.every((m) => m.requiresVision === true)).toBe(true);
    expect(vision.map((m) => m.modelId)).not.toContain('big-pickle');
  });

  it('puts the first free vision model ahead of the other vision models', async () => {
    const { selectFreeModels } = await import('@/lib/ai/fallback');
    expect(selectFreeModels(true)[0].modelId).toBe('mimo-v2.5-free');
  });

  it('keeps every text model available for a text race', async () => {
    const { selectFreeModels } = await import('@/lib/ai/fallback');
    const ids = selectFreeModels(false).map((m) => m.modelId);
    expect(ids).toContain('big-pickle');
    expect(ids).toContain('llama-3.3-70b-versatile');
    expect(ids).toContain('gemma2-9b-it');
    expect(ids).toContain('google/gemma-3-27b-it:free');
    expect(ids).toContain('openrouter/free');
  });

  it('returns the first configured model even when a later one answers first', async () => {
    const { raceFreeProviders } = await import('@/lib/ai/fallback');
    const result = await raceFreeProviders(
      async (_model, config) => {
        // Everyone except the preferred model answers instantly.
        const delay = config.modelId === 'big-pickle' ? 20 : 0;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return { result: config.modelId };
      },
      { endpoint: 'test' },
    );

    expect(result.success).toBe(true);
    expect(result.success && result.model).toBe('big-pickle');
  });

  it('does not call big-pickle for a vision race', async () => {
    const { raceFreeProviders } = await import('@/lib/ai/fallback');
    const seen: string[] = [];

    const result = await raceFreeProviders(
      async (_model, config) => {
        seen.push(config.modelId);
        return { result: config.modelId };
      },
      { endpoint: 'test', visionOnly: true },
    );

    expect(seen).not.toContain('big-pickle');
    expect(result.success && result.model).toBe('mimo-v2.5-free');
  });
});
