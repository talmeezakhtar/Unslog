import type { Config } from '../config.js';
import { GeminiProvider } from './gemini.js';
import { GroqProvider } from './groq.js';
import { AiRouter, type UsageStore } from './router.js';
import type { LlmProvider } from './types.js';

/** Providers in priority order: Gemini first, Groq as fallback. Missing keys are skipped. */
export function buildRouter(config: Config, usage: UsageStore): AiRouter {
  const providers: LlmProvider[] = [];
  if (config.GEMINI_API_KEY) {
    providers.push(
      new GeminiProvider(
        config.GEMINI_API_KEY,
        { score: config.GEMINI_SCORE_MODEL, draft: config.GEMINI_DRAFT_MODEL },
        config.GEMINI_DAILY_LIMIT,
        config.GEMINI_MIN_INTERVAL_MS,
      ),
    );
  }
  if (config.GROQ_API_KEY) {
    providers.push(new GroqProvider(config.GROQ_API_KEY, config.GROQ_MODEL, config.GROQ_DAILY_LIMIT, config.GROQ_MIN_INTERVAL_MS));
  }
  return new AiRouter(providers, usage);
}

export { AiRouter, NoProviderAvailable } from './router.js';
