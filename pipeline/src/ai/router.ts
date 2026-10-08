import type { z } from 'zod';
import { HttpError, Throttle } from '../lib/http.js';
import { errorMessage, log } from '../lib/log.js';
import type { LlmProvider, Prompt, Purpose } from './types.js';

/** Where the router reads and writes daily usage (the ai_usage table in production). */
export interface UsageStore {
  aiRequestsToday(provider: string): Promise<number>;
  recordAiUsage(u: { provider: string; model: string; purpose: string; tokensIn: number; tokensOut: number; failed: boolean }): Promise<void>;
}

export class NoProviderAvailable extends Error {
  constructor(detail: string) {
    super(`No AI provider available: ${detail}`);
    this.name = 'NoProviderAvailable';
  }
}

interface ProviderState {
  provider: LlmProvider;
  throttle: Throttle;
  consecutiveFailures: number;
  /** Circuit breaker: once open, the provider is skipped for the rest of this run. */
  open: boolean;
  usedToday: number | null;
}

const BREAKER_THRESHOLD = 3;

/**
 * Sends each request to the first provider that is healthy and under its daily limit, and
 * falls back to the next one on failure. Concepts: fallback, circuit breaker, quota tracking,
 * client-side rate limiting, and validating AI output with a schema.
 */
export class AiRouter {
  private readonly states: ProviderState[];

  constructor(providers: LlmProvider[], private readonly usage: UsageStore) {
    this.states = providers.map((provider) => ({
      provider,
      throttle: new Throttle(provider.minIntervalMs),
      consecutiveFailures: 0,
      open: false,
      usedToday: null,
    }));
  }

  get hasProviders(): boolean {
    return this.states.length > 0;
  }

  /** True when at least one provider is still usable in this run. */
  async available(): Promise<boolean> {
    for (const s of this.states) if (!s.open && (await this.underLimit(s))) return true;
    return false;
  }

  private async underLimit(s: ProviderState): Promise<boolean> {
    if (s.usedToday === null) s.usedToday = await this.usage.aiRequestsToday(s.provider.name);
    return s.usedToday < s.provider.dailyLimit;
  }

  /**
   * Ask for JSON and validate it. Invalid JSON gets one retry on the same provider with a
   * stricter instruction, then the next provider is tried.
   */
  async json<S extends z.ZodTypeAny>(purpose: Purpose, prompt: Prompt, schema: S): Promise<{ data: z.output<S>; model: string }> {
    return this.run(purpose, { ...prompt, json: true }, (text) => {
      const parsed = schema.safeParse(extractJson(text));
      if (!parsed.success) throw new InvalidOutput(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
      return parsed.data as z.output<S>;
    });
  }

  /** Ask for plain text (drafts). */
  async text(purpose: Purpose, prompt: Prompt): Promise<{ data: string; model: string }> {
    return this.run(purpose, { ...prompt, json: false }, (text) => {
      const out = text.trim();
      if (!out) throw new InvalidOutput('empty');
      return out;
    });
  }

  private async run<T>(purpose: Purpose, prompt: Prompt, accept: (text: string) => T): Promise<{ data: T; model: string }> {
    const reasons: string[] = [];
    for (const s of this.states) {
      if (s.open) {
        reasons.push(`${s.provider.name}: circuit open`);
        continue;
      }
      if (!(await this.underLimit(s))) {
        reasons.push(`${s.provider.name}: daily limit reached`);
        continue;
      }
      for (let attempt = 0; attempt < 2; attempt++) {
        const model = s.provider.model(purpose);
        const p =
          attempt === 0
            ? prompt
            : { ...prompt, user: `${prompt.user}\n\nYour previous answer was not valid. Reply with ONLY the requested output, nothing else.` };
        await s.throttle.wait();
        try {
          const out = await s.provider.complete(p, purpose);
          s.usedToday = (s.usedToday ?? 0) + 1;
          await this.usage.recordAiUsage({ provider: s.provider.name, model, purpose, tokensIn: out.tokensIn, tokensOut: out.tokensOut, failed: false });
          const data = accept(out.text);
          s.consecutiveFailures = 0;
          return { data, model: `${s.provider.name}/${model}` };
        } catch (err) {
          if (err instanceof InvalidOutput && attempt === 0) {
            log.warn('AI output invalid, retrying once', { provider: s.provider.name, detail: err.message.slice(0, 200) });
            continue;
          }
          if (!(err instanceof InvalidOutput)) {
            s.usedToday = (s.usedToday ?? 0) + 1;
            await this.usage.recordAiUsage({ provider: s.provider.name, model, purpose, tokensIn: 0, tokensOut: 0, failed: true });
          }
          s.consecutiveFailures++;
          // A 429 that survived retries, or a key/permission problem, will not fix itself this run.
          const fatal = err instanceof HttpError && (err.status === 429 || err.status === 401 || err.status === 403);
          if (fatal || s.consecutiveFailures >= BREAKER_THRESHOLD) {
            s.open = true;
            log.warn('AI provider disabled for this run', { provider: s.provider.name, reason: errorMessage(err).slice(0, 200) });
          } else {
            log.warn('AI call failed, trying next provider', { provider: s.provider.name, reason: errorMessage(err).slice(0, 200) });
          }
          reasons.push(`${s.provider.name}: ${errorMessage(err).slice(0, 120)}`);
          break;
        }
      }
    }
    // Only say "no provider" when none can be used any more; one bad answer is a per-request failure.
    if (!(await this.available())) throw new NoProviderAvailable(reasons.join(' | ') || 'no providers configured');
    throw new AiRequestFailed(reasons.join(' | '));
  }
}

/** This one request failed on every provider, but providers are still usable for the next one. */
export class AiRequestFailed extends Error {
  constructor(detail: string) {
    super(`AI request failed: ${detail}`);
    this.name = 'AiRequestFailed';
  }
}

export class InvalidOutput extends Error {
  constructor(detail: string) {
    super(`Invalid AI output: ${detail}`);
    this.name = 'InvalidOutput';
  }
}

/** Models sometimes wrap JSON in ``` fences or add a sentence; take the first {...} object. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1]! : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return undefined;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return undefined;
  }
}
