import { request } from '../lib/http.js';
import type { Completion, LlmProvider, Prompt, Purpose } from './types.js';

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * Groq: fast hosted open models with a free tier and an OpenAI-compatible API.
 * Get a key at https://console.groq.com/keys. Used as the fallback when Gemini is unavailable.
 */
export class GroqProvider implements LlmProvider {
  readonly name = 'groq';
  constructor(
    private readonly apiKey: string,
    private readonly modelId: string,
    readonly dailyLimit: number,
    readonly minIntervalMs: number,
  ) {}

  model(): string {
    return this.modelId;
  }

  async complete(prompt: Prompt, _purpose: Purpose): Promise<Completion> {
    const res = await request('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.modelId,
        temperature: prompt.temperature ?? 0.3,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        ...(prompt.json ? { response_format: { type: 'json_object' } } : {}),
      }),
      retries: 1,
      timeoutMs: 60_000,
      backoffMs: 3000,
    });
    const data = (await res.json()) as ChatResponse;
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) throw new Error('Groq returned no text');
    return { text, tokensIn: data.usage?.prompt_tokens ?? 0, tokensOut: data.usage?.completion_tokens ?? 0 };
  }
}
