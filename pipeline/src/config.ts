import { z } from 'zod';
import { loadEnv } from './lib/env.js';

/**
 * All configuration comes from environment variables (a local .env file, or GitHub Actions secrets).
 * Secrets never live in code or in the database. Every AI / source key is optional: when one is
 * missing, that part of the pipeline is skipped and the rest still runs.
 */
const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

const int = (fallback: number) => z.coerce.number().int().nonnegative().default(fallback);

const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (Supabase: Project settings > Database > Connection string)'),
  APP_URL: optional.transform((v) => (v ?? 'http://localhost:5173').replace(/\/+$/, '')),

  GEMINI_API_KEY: optional,
  GEMINI_SCORE_MODEL: z.string().default('gemini-3.5-flash-lite'),
  GEMINI_DRAFT_MODEL: z.string().default('gemini-3.8-flash'),
  GEMINI_DAILY_LIMIT: int(200),
  GEMINI_MIN_INTERVAL_MS: int(4500),

  GROQ_API_KEY: optional,
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  GROQ_DAILY_LIMIT: int(500),
  GROQ_MIN_INTERVAL_MS: int(2500),

  JOOBLE_API_KEY: optional,
  JOOBLE_HOST: z.string().default('jooble.org'),
  JOOBLE_PAGES: int(2),

  GMAIL_CLIENT_ID: optional,
  GMAIL_CLIENT_SECRET: optional,
  GMAIL_REFRESH_TOKEN: optional,
  GMAIL_QUERY_DAYS: int(3),

  TELEGRAM_BOT_TOKEN: optional,

  DRAFT_TOP_N: int(10),
  DIGEST_TOP_N: int(10),
  /** Per-user ceiling on AI scoring calls against the shared Gemini/Groq key, separate from (and
   *  usually smaller than) a profile's own max_ai_jobs_per_day. Without it, one signed-up user
   *  could set their own cap to 500 and burn the whole shared daily quota alone, leaving nothing
   *  for anyone else that day — including you. Only applies when the user hasn't brought their
   *  own Gemini/Groq key; BYOK users spend their own quota and aren't capped by this. */
  SHARED_AI_MAX_JOBS_PER_USER_PER_DAY: int(20),
  HTTP_USER_AGENT: z.string().default('UnslogJobCopilot/0.1 (personal job search tool)'),
  HTTP_DELAY_MS: int(1500),
  /** Comma-separated user ids the pipeline serves. Empty = everyone with a profile. */
  ALLOWED_USER_IDS: optional.transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [])),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env?: NodeJS.ProcessEnv): Config {
  if (!env) loadEnv();
  const parsed = schema.safeParse(env ?? process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${problems}\nSee .env.example and docs/01-getting-started.md`);
  }
  return parsed.data;
}
