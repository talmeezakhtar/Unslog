import { request } from '../lib/http.js';
import type { Completion, LlmProvider, Prompt, Purpose } from './types.js';

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  promptFeedback?: { blockReason?: string };
}

/**
 * Google Gemini through the Gemini Developer API (free tier for Flash / Flash-Lite models).
 * Get a key at https://aistudio.google.com/apikey. Docs: https://ai.google.dev/gemini-api/docs
 */
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';
  constructor(
    private readonly apiKey: string,
    private readonly models: { score: string; draft: string },
    readonly dailyLimit: number,
    readonly minIntervalMs: number,
  ) {}

  model(purpose: Purpose): string {
    return this.models[purpose];
  }

  async complete(prompt: Prompt, purpose: Purpose): Promise<Completion> {
    const model = this.model(purpose);
    const res = await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      // The key goes in a header, never in the URL, so it can't leak into logs.
      headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: prompt.system }] },
        contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
        generationConfig: {
          temperature: prompt.temperature ?? 0.3,
          ...(prompt.json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
      retries: 1,
      timeoutMs: 60_000,
      backoffMs: 4000,
    });
    const data = (await res.json()) as GeminiResponse;
    if (data.promptFeedback?.blockReason) throw new Error(`Gemini blocked the prompt: ${data.promptFeedback.blockReason}`);
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!text) throw new Error(`Gemini returned no text (finishReason: ${data.candidates?.[0]?.finishReason ?? 'unknown'})`);
    return {
      text,
      tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
      tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }
}
