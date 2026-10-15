import { buildRouter, type AiRouter } from './ai/index.js';
import { buildCollectors, buildPersonalCollectors } from './collectors/index.js';
import type { Collector, RawJob } from './collectors/types.js';
import type { Config } from './config.js';
import type { Repo } from './db/repo.js';
import { errorMessage, log } from './lib/log.js';
import { writeDrafts } from './stages/draft.js';
import { extractSkills, type Skill } from './stages/enrich.js';
import { normalize } from './stages/normalize.js';
import { prefilter } from './stages/prefilter.js';
import { scoreJobs } from './stages/score.js';
import { sendDigest } from './stages/digest.js';
import type { Profile } from './types.js';

export const STEPS = ['collect', 'match', 'score', 'followups', 'draft', 'digest'] as const;
export type Step = (typeof STEPS)[number];

export interface RunSummary {
  collectors: Array<{ name: string; status: 'ok' | 'failed' | 'skipped'; found: number; new: number; error?: string }>;
  users: Array<{ userId: string; matched: number; passed: number; aiScored: number; heuristic: number; drafted: number; followUps: number; digest: string }>;
}

/**
 * Stores one collector's jobs: raw copy → normalize → dedupe into jobs + sightings → tag skills.
 * Idempotent: running it twice with the same jobs changes nothing but last_seen_at.
 */
export async function ingest(
  repo: Repo,
  runId: string,
  sourceIds: Map<string, string>,
  skills: Skill[],
  jobs: RawJob[],
  userId: string | null = null,
): Promise<{ found: number; newCount: number }> {
  let newCount = 0;
  let found = 0;
  // ponytail: one small transaction per job, not a batched multi-row upsert — a few hundred
  // jobs/day means a few thousand round trips, which is fine on a once-a-day Actions run.
  // Switch to unnest()-based batch upserts (like setJobSkills) if daily volume moves into the
  // thousands and run time starts to matter.
  for (const raw of jobs) {
    const sourceId = sourceIds.get(raw.sourceKey);
    if (!sourceId) {
      log.warn('job from unknown source skipped', { source: raw.sourceKey });
      continue;
    }
    const rawId = await repo.saveRaw(runId, sourceId, raw);
    const job = normalize(raw);
    if (!job) continue;
    found++;
    // One job's company/job/sighting/skill writes succeed or fail together, so a crash mid-job
    // never leaves raw_listings.job_id unlinked for a job that's missing its sighting/skills.
    const inserted = await repo.transaction(async (tx) => {
      const companyId = job.companyName && job.companyNormalized ? await tx.upsertCompany(job.companyName, job.companyNormalized) : null;
      const { id, inserted } = await tx.upsertJob(job, companyId);
      await tx.upsertSighting(id, sourceId, job.sighting.url, job.sighting.externalId, userId);
      await tx.linkRaw(rawId, id);
      const tags = extractSkills(`${job.title}\n${job.description ?? ''}`, skills);
      await tx.setJobSkills(id, tags.map((s) => s.id));
      return inserted;
    });
    if (inserted) newCount++;
  }
  return { found, newCount };
}

async function runCollector(repo: Repo, collector: Collector, skills: Skill[], userId: string | null = null): Promise<RunSummary['collectors'][number]> {
  const runId = await repo.startRun(collector.name);
  const started = Date.now();
  try {
    const result = await collector.collect();
    const sourceIds = await repo.upsertSources(result.sources);
    const { found, newCount } = await ingest(repo, runId, sourceIds, skills, result.jobs, userId);
    await repo.finishRun(runId, { found, newCount });
    await repo.markSources(result.sources.map((s) => s.key));
    log.info('collector done', { collector: collector.name, runId, found, new: newCount, ms: Date.now() - started });
    return { name: collector.name, status: 'ok', found, new: newCount };
  } catch (err) {
    const error = errorMessage(err).slice(0, 1000);
    await repo.finishRun(runId, { found: 0, newCount: 0, error });
    await repo.markSources(collector.sourceKeys, error);
    log.error('collector failed (other collectors continue)', { collector: collector.name, runId, error, ms: Date.now() - started });
    return { name: collector.name, status: 'failed', found: 0, new: 0, error };
  }
}

/** Profile skills typed freely ("node", "springboot") mapped onto dictionary names ("Node.js", "Spring Boot"). */
export function canonicalProfile(p: Profile, skills: Skill[]): Profile {
  const canonical = extractSkills(p.skills.join(', '), skills).map((s) => s.name);
  return { ...p, skills: [...new Set([...canonical, ...p.skills])] };
}

export async function matchUser(repo: Repo, profile: Profile, now = new Date()): Promise<{ matched: number; passed: number }> {
  const jobs = await repo.unmatchedJobs(profile.userId);
  let passed = 0;
  for (const job of jobs) {
    const r = prefilter(job, profile, now);
    if (r.passed) passed++;
    await repo.insertMatch(profile.userId, job.id, r);
  }
  return { matched: jobs.length, passed };
}

/** A profile scoring against the shared Gemini/Groq key can't claim more of it than this slice,
 *  regardless of its own max_ai_jobs_per_day (up to 500) — otherwise one signed-up user could
 *  exhaust the whole day's shared quota alone. BYOK users spend their own key and keep their
 *  full setting. */
export function scoringProfile(profile: Profile, hasOwnKey: boolean, config: Pick<Config, 'SHARED_AI_MAX_JOBS_PER_USER_PER_DAY'>): Profile {
  if (hasOwnKey) return profile;
  return { ...profile, maxAiJobsPerDay: Math.min(profile.maxAiJobsPerDay, config.SHARED_AI_MAX_JOBS_PER_USER_PER_DAY) };
}

export interface RunOptions {
  steps?: readonly Step[];
  /** Inject collectors (tests); defaults to buildCollectors(config, ...). */
  collectors?: Collector[];
  /** Inject an AI router (tests); defaults to buildRouter(config, repo). */
  ai?: AiRouter;
}

/** The whole daily run. Each stage is isolated: one failure is logged and the rest continue. */
export async function runPipeline(config: Config, repo: Repo, opts: RunOptions = {}): Promise<RunSummary> {
  const steps = new Set(opts.steps ?? STEPS);
  const summary: RunSummary = { collectors: [], users: [] };
  const skills = await repo.skills();
  const allowed = new Set(config.ALLOWED_USER_IDS);
  const allProfiles = await repo.profiles();
  const profiles = allProfiles.filter((p) => allowed.size === 0 || allowed.has(p.userId)).map((p) => canonicalProfile(p, skills));
  if (profiles.length === 0) log.warn('no profiles yet: sign in to the dashboard and fill in Settings first');
  // Without ALLOWED_USER_IDS, anyone who signs up to the dashboard gets a profile processed
  // here and spends your AI quota. Fine with exactly one profile (you); worth a loud warning
  // once a second profile shows up, in case sign-ups were never locked down in Supabase.
  if (allowed.size === 0 && allProfiles.length > 1) {
    log.warn('ALLOWED_USER_IDS is empty and more than one profile exists: anyone who signs up can spend your AI quota', {
      profiles: allProfiles.length,
    });
  }

  const disabled = await repo.disabledSourceKeys();
  const runAndRecord = async (c: Collector, userId: string | null = null): Promise<RunSummary['collectors'][number]> => {
    if (!c.isConfigured()) {
      log.info('collector skipped (not configured)', { collector: c.name, user: userId ?? undefined });
      return { name: c.name, status: 'skipped', found: 0, new: 0 };
    }
    if (disabled.has(c.name) || (c.sourceKeys.length > 0 && c.sourceKeys.every((k) => disabled.has(k)))) {
      return { name: c.name, status: 'skipped', found: 0, new: 0 };
    }
    return runCollector(repo, c, skills, userId);
  };

  // Tests inject a fixed collector list for the whole run via opts.collectors; real runs split
  // into shared public sources (once, below) and personal sources (per profile, in the loop).
  if (steps.has('collect') && opts.collectors) {
    for (const c of opts.collectors) summary.collectors.push(await runAndRecord(c));
  } else if (steps.has('collect')) {
    const companies = profiles.flatMap((p) => p.targetCompanies).filter((c, i, all) => all.findIndex((x) => x.ats === c.ats && x.slug === c.slug) === i);
    for (const c of buildCollectors(config, { companies })) summary.collectors.push(await runAndRecord(c));
  }

  const gmailSince = await repo.lastSuccessAt('gmail');
  const personalRuns: RunSummary['collectors'] = [];
  const ai = opts.ai ?? buildRouter(config, repo);

  for (const profile of profiles) {
    const secrets = await repo.secrets(profile.userId);

    if (steps.has('collect') && !opts.collectors) {
      const searches = await repo.searchesFor(profile);
      for (const c of buildPersonalCollectors(config, secrets, searches, gmailSince)) {
        personalRuns.push(await runAndRecord(c, profile.userId));
      }
    }

    // Per-user Gemini/Groq key if they've brought one, falling back to the instance-wide .env
    // key otherwise — same BYOK-or-shared-default pattern as Jooble above.
    const hasOwnKey = Boolean(secrets.geminiApiKey || secrets.groqApiKey);
    const profileAi = opts.ai ?? (hasOwnKey ? buildRouter({ ...config, GEMINI_API_KEY: secrets.geminiApiKey ?? config.GEMINI_API_KEY, GROQ_API_KEY: secrets.groqApiKey ?? config.GROQ_API_KEY }, repo) : ai);
    // opts.ai (tests) injects a fixed router that isn't actually the shared instance-wide one,
    // so the fairness cap doesn't apply to it.
    const scoreProfile = opts.ai ? profile : scoringProfile(profile, hasOwnKey, config);

    const u = { userId: profile.userId, matched: 0, passed: 0, aiScored: 0, heuristic: 0, drafted: 0, followUps: 0, digest: 'skipped' };
    const stage = async (name: Step, fn: () => Promise<void>) => {
      if (!steps.has(name)) return;
      const started = Date.now();
      try {
        await fn();
        log.debug('stage done', { stage: name, user: profile.userId, ms: Date.now() - started });
      } catch (err) {
        log.error(`${name} failed for user`, { user: profile.userId, error: errorMessage(err), ms: Date.now() - started });
      }
    };
    await stage('match', async () => {
      Object.assign(u, await matchUser(repo, profile));
    });
    await stage('score', async () => {
      const r = await scoreJobs(repo, profileAi, scoreProfile);
      u.aiScored = r.ai;
      u.heuristic = r.heuristic;
    });
    await stage('followups', async () => {
      u.followUps = (await repo.markFollowUpsDue(profile.userId)).length;
    });
    await stage('draft', async () => {
      u.drafted = (await writeDrafts(repo, profileAi, profile, config.DRAFT_TOP_N)).jobs;
    });
    await stage('digest', async () => {
      u.digest = await sendDigest(config, repo, profile);
    });
    log.info('user done', u);
    summary.users.push(u);
  }

  for (const merged of mergeCollectorSummary(personalRuns)) summary.collectors.push(merged);
  return summary;
}

/** Gmail/Jooble now run once per profile; fold those into one summary line per collector name,
 *  the same shape a single global run used to produce (sum counts, worst status wins). */
function mergeCollectorSummary(runs: RunSummary['collectors']): RunSummary['collectors'] {
  const byName = new Map<string, RunSummary['collectors'][number]>();
  const rank = { failed: 2, ok: 1, skipped: 0 } as const;
  for (const r of runs) {
    const existing = byName.get(r.name);
    if (!existing) {
      byName.set(r.name, { ...r });
      continue;
    }
    existing.found += r.found;
    existing.new += r.new;
    if (rank[r.status] > rank[existing.status]) existing.status = r.status;
    if (r.error) existing.error = existing.error ? `${existing.error}; ${r.error}` : r.error;
  }
  return [...byName.values()];
}
