import { buildRouter, type AiRouter } from './ai/index.js';
import { buildCollectors } from './collectors/index.js';
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
export async function ingest(repo: Repo, runId: string, sourceIds: Map<string, string>, skills: Skill[], jobs: RawJob[]): Promise<{ found: number; newCount: number }> {
  let newCount = 0;
  let found = 0;
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
    const companyId = job.companyName && job.companyNormalized ? await repo.upsertCompany(job.companyName, job.companyNormalized) : null;
    const { id, inserted } = await repo.upsertJob(job, companyId);
    if (inserted) newCount++;
    await repo.upsertSighting(id, sourceId, job.sighting.url, job.sighting.externalId);
    await repo.linkRaw(rawId, id);
    const tags = extractSkills(`${job.title}\n${job.description ?? ''}`, skills);
    await repo.setJobSkills(id, tags.map((s) => s.id));
  }
  return { found, newCount };
}

async function runCollector(repo: Repo, collector: Collector, skills: Skill[]): Promise<RunSummary['collectors'][number]> {
  const runId = await repo.startRun(collector.name);
  try {
    const result = await collector.collect();
    const sourceIds = await repo.upsertSources(result.sources);
    const { found, newCount } = await ingest(repo, runId, sourceIds, skills, result.jobs);
    await repo.finishRun(runId, { found, newCount });
    await repo.markSources(result.sources.map((s) => s.key));
    log.info('collector done', { collector: collector.name, found, new: newCount });
    return { name: collector.name, status: 'ok', found, new: newCount };
  } catch (err) {
    const error = errorMessage(err).slice(0, 1000);
    await repo.finishRun(runId, { found: 0, newCount: 0, error });
    await repo.markSources(collector.sourceKeys, error);
    log.error('collector failed (other collectors continue)', { collector: collector.name, error });
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
  const profiles = (await repo.profiles())
    .filter((p) => allowed.size === 0 || allowed.has(p.userId))
    .map((p) => canonicalProfile(p, skills));
  if (profiles.length === 0) log.warn('no profiles yet: sign in to the dashboard and fill in Settings first');

  if (steps.has('collect')) {
    const searches = await repo.searches(profiles);
    const companies = profiles.flatMap((p) => p.targetCompanies).filter((c, i, all) => all.findIndex((x) => x.ats === c.ats && x.slug === c.slug) === i);
    const collectors = opts.collectors ?? buildCollectors(config, { searches, companies });
    const disabled = await repo.disabledSourceKeys();
    for (const c of collectors) {
      if (!c.isConfigured()) {
        log.info('collector skipped (not configured)', { collector: c.name });
        summary.collectors.push({ name: c.name, status: 'skipped', found: 0, new: 0 });
        continue;
      }
      if (disabled.has(c.name) || (c.sourceKeys.length > 0 && c.sourceKeys.every((k) => disabled.has(k)))) {
        summary.collectors.push({ name: c.name, status: 'skipped', found: 0, new: 0 });
        continue;
      }
      summary.collectors.push(await runCollector(repo, c, skills));
    }
  }

  const ai = opts.ai ?? buildRouter(config, repo);
  for (const profile of profiles) {
    const u = { userId: profile.userId, matched: 0, passed: 0, aiScored: 0, heuristic: 0, drafted: 0, followUps: 0, digest: 'skipped' };
    const stage = async (name: Step, fn: () => Promise<void>) => {
      if (!steps.has(name)) return;
      try {
        await fn();
      } catch (err) {
        log.error(`${name} failed for user`, { user: profile.userId, error: errorMessage(err) });
      }
    };
    await stage('match', async () => {
      Object.assign(u, await matchUser(repo, profile));
    });
    await stage('score', async () => {
      const r = await scoreJobs(repo, ai, profile);
      u.aiScored = r.ai;
      u.heuristic = r.heuristic;
    });
    await stage('followups', async () => {
      u.followUps = (await repo.markFollowUpsDue(profile.userId)).length;
    });
    await stage('draft', async () => {
      u.drafted = (await writeDrafts(repo, ai, profile, config.DRAFT_TOP_N)).jobs;
    });
    await stage('digest', async () => {
      u.digest = await sendDigest(config, repo, profile);
    });
    log.info('user done', u);
    summary.users.push(u);
  }
  return summary;
}
