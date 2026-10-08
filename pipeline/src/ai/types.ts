/** One chat-style request to a language model. */
export interface Prompt {
  system: string;
  user: string;
  /** Ask the model for a JSON object only. */
  json: boolean;
  temperature?: number;
}

export interface Completion {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

export type Purpose = 'score' | 'draft';

/**
 * Adapter pattern: every AI provider looks the same to the rest of the code, so switching
 * Gemini for Groq (or adding Ollama) touches one file.
 */
export interface LlmProvider {
  readonly name: string;
  /** The model this provider uses for a purpose (scoring can use a cheaper, faster model). */
  model(purpose: Purpose): string;
  complete(prompt: Prompt, purpose: Purpose): Promise<Completion>;
  /** Free-tier requests per day we allow ourselves. */
  readonly dailyLimit: number;
  /** Minimum gap between calls, to stay under requests-per-minute limits. */
  readonly minIntervalMs: number;
}
