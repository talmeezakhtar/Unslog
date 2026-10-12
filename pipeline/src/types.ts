/** Domain types shared across stages. Mirrors the tables in supabase/migrations. */

export interface Profile {
  userId: string;
  fullName: string | null;
  headline: string | null;
  skills: string[];
  yearsExperience: number;
  targetTitles: string[];
  cities: string[];
  visaStatus: 'visit' | 'resident' | 'needs_sponsorship';
  cvText: string | null;
  highlightProject: string | null;
  mustHave: string[];
  blockedWords: string[];
  minScore: number;
  maxAiJobsPerDay: number;
  followUpDays: number;
  targetCompanies: Array<{ ats: string; slug: string; name?: string }>;
  digestChannel: 'none' | 'telegram' | 'email';
  digestEmail: string | null;
  telegramChatId: string | null;
}

/** BYOK credentials, one row per user. Any field can be null: the pipeline skips what's missing
 *  (Gmail: no fallback, a missing token just means that user has no Gmail collector built for
 *  them. Jooble/Gemini/Groq: callers fall back to the instance-wide .env key when absent). */
export interface UserSecrets {
  gmailRefreshToken: string | null;
  joobleApiKey: string | null;
  geminiApiKey: string | null;
  groqApiKey: string | null;
}

/** A job as the matching stages see it. */
export interface JobForMatching {
  id: string;
  title: string;
  company: string | null;
  city: string | null;
  description: string | null;
  experienceMin: number | null;
  visaFlags: string[];
  skills: string[];
  postedAt: Date | null;
  firstSeenAt: Date;
}
