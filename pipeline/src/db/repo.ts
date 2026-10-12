import type { RawJob, SourceInfo } from '../collectors/types.js';
import type { Skill } from '../stages/enrich.js';
import type { NormalizedJob } from '../stages/normalize.js';
import type { PrefilterResult } from '../stages/prefilter.js';
import type { JobForMatching, Profile, UserSecrets } from '../types.js';
import type { Db } from './client.js';

/**
 * Every SQL statement the pipeline runs lives in this file (Repository pattern), so the stages
 * stay plain functions and the database can be swapped or mocked in one place.
 */
export class Repo {
  constructor(private readonly db: Db) {}

  /** Runs fn with a Repo bound to one transactional connection; commits on success, rolls back on error. */
  async transaction<T>(fn: (repo: Repo) => Promise<T>): Promise<T> {
    return this.db.transaction((txDb) => fn(new Repo(txDb)));
  }

  // ---------------------------------------------------------------- users

  async profiles(): Promise<Profile[]> {
    const { rows } = await this.db.query(`select * from profiles order by created_at`);
    return rows.map((r) => ({
      userId: r.user_id,
      fullName: r.full_name,
      headline: r.headline,
      skills: r.skills ?? [],
      yearsExperience: r.years_experience ?? 0,
      targetTitles: r.target_titles ?? [],
      cities: r.cities ?? [],
      visaStatus: r.visa_status,
      cvText: r.cv_text,
      highlightProject: r.highlight_project,
      mustHave: r.must_have ?? [],
      blockedWords: r.blocked_words ?? [],
      minScore: r.min_score,
      maxAiJobsPerDay: r.max_ai_jobs_per_day,
      followUpDays: r.follow_up_days,
      targetCompanies: Array.isArray(r.target_companies) ? r.target_companies : [],
      digestChannel: r.digest_channel,
      digestEmail: r.digest_email,
      telegramChatId: r.telegram_chat_id,
    }));
  }

  /** Distinct keyword searches for API collectors: saved searches, else each user's target titles. */
  async searches(profiles: Profile[]): Promise<Array<{ keywords: string; location: string }>> {
    const { rows } = await this.db.query<{ keywords: string; location: string }>(
      `select distinct lower(trim(keywords)) as keywords, location from saved_searches
       where enabled and site = 'jooble' and trim(keywords) <> ''`,
    );
    const withSearches = new Set(
      (await this.db.query<{ user_id: string }>(`select distinct user_id from saved_searches where enabled and site = 'jooble'`)).rows.map(
        (r) => r.user_id,
      ),
    );
    const fromTitles = profiles
      .filter((p) => !withSearches.has(p.userId))
      .flatMap((p) => p.targetTitles.map((t) => ({ keywords: t.toLowerCase().trim(), location: 'United Arab Emirates' })));
    const seen = new Set<string>();
    return [...rows, ...fromTitles].filter((s) => {
      const k = `${s.keywords}|${s.location}`;
      if (!s.keywords || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  /** One user's BYOK credentials, or all-null if they've never saved any. */
  async secrets(userId: string): Promise<UserSecrets> {
    const { rows } = await this.db.query<{ gmail_refresh_token: string | null; jooble_api_key: string | null; gemini_api_key: string | null; groq_api_key: string | null }>(
      `select gmail_refresh_token, jooble_api_key, gemini_api_key, groq_api_key from user_secrets where user_id = $1`,
      [userId],
    );
    const r = rows[0];
    return {
      gmailRefreshToken: r?.gmail_refresh_token ?? null,
      joobleApiKey: r?.jooble_api_key ?? null,
      geminiApiKey: r?.gemini_api_key ?? null,
      groqApiKey: r?.groq_api_key ?? null,
    };
  }

  /** One user's own Jooble searches (or their target titles, if they haven't saved any). */
  async searchesFor(profile: Profile): Promise<Array<{ keywords: string; location: string }>> {
    const { rows } = await this.db.query<{ keywords: string; location: string }>(
      `select distinct lower(trim(keywords)) as keywords, location from saved_searches
       where enabled and site = 'jooble' and trim(keywords) <> '' and user_id = $1`,
      [profile.userId],
    );
    if (rows.length > 0) return rows;
    return profile.targetTitles.map((t) => ({ keywords: t.toLowerCase().trim(), location: 'United Arab Emirates' })).filter((s) => s.keywords);
  }

  async skills(): Promise<Skill[]> {
    const { rows } = await this.db.query<Skill>(`select id, name, aliases from skills`);
    return rows.map((r) => ({ ...r, aliases: (r.aliases ?? []).map((a) => a.toLowerCase()) }));
  }

  // ---------------------------------------------------------------- sources and runs

  async upsertSources(sources: SourceInfo[]): Promise<Map<string, string>> {
    const ids = new Map<string, string>();
    for (const s of sources) {
      const { rows } = await this.db.query<{ id: string }>(
        `insert into sources (key, name, kind, config) values ($1, $2, $3, $4)
         on conflict (key) do update set name = excluded.name, config = excluded.config
         returning id`,
        [s.key, s.name, s.kind, JSON.stringify(s.config ?? {})],
      );
      ids.set(s.key, rows[0]!.id);
    }
    return ids;
  }

  /**
   * Sources switched off with `update sources set enabled = false where key = '...'`.
   * Collectors whose name matches a disabled key (e.g. 'jooble', 'ats:lever:acme') are skipped.
   */
  async disabledSourceKeys(): Promise<Set<string>> {
    const { rows } = await this.db.query<{ key: string }>(`select key from sources where not enabled`);
    return new Set(rows.map((r) => r.key));
  }

  async startRun(collector: string): Promise<string> {
    const { rows } = await this.db.query<{ id: string }>(
      `insert into collector_runs (collector) values ($1) returning id`,
      [collector],
    );
    return rows[0]!.id;
  }

  async finishRun(id: string, r: { found: number; newCount: number; error?: string }): Promise<void> {
    await this.db.query(
      `update collector_runs set finished_at = now(), found = $2, new_count = $3, status = $4, error = $5 where id = $1`,
      [id, r.found, r.newCount, r.error ? 'failed' : 'success', r.error ?? null],
    );
  }

  /** When a collector last finished successfully, used to narrow incremental collection windows. */
  async lastSuccessAt(collector: string): Promise<Date | null> {
    const { rows } = await this.db.query<{ finished_at: Date | null }>(
      `select finished_at from collector_runs where collector = $1 and status = 'success' order by finished_at desc limit 1`,
      [collector],
    );
    return rows[0]?.finished_at ?? null;
  }

  async markSources(keys: string[], error?: string): Promise<void> {
    if (keys.length === 0) return;
    await this.db.query(
      error
        ? `update sources set last_error = $2 where key = any($1)`
        : `update sources set last_success_at = now(), last_error = null where key = any($1)`,
      error ? [keys, error] : [keys],
    );
  }

  // ---------------------------------------------------------------- raw data and jobs

  async saveRaw(runId: string, sourceId: string, job: RawJob): Promise<string> {
    const { rows } = await this.db.query<{ id: string }>(
      `insert into raw_listings (source_id, collector_run_id, external_id, payload) values ($1, $2, $3, $4)
       on conflict (source_id, external_id) do update set payload = excluded.payload, fetched_at = now(),
         collector_run_id = excluded.collector_run_id
       returning id`,
      [sourceId, runId, job.externalId, JSON.stringify(job.raw ?? {})],
    );
    return rows[0]!.id;
  }

  async upsertCompany(name: string, normalized: string): Promise<string> {
    const { rows } = await this.db.query<{ id: string }>(
      `insert into companies (name, normalized_name) values ($1, $2)
       on conflict (normalized_name) do update set name = companies.name
       returning id`,
      [name, normalized],
    );
    return rows[0]!.id;
  }

  /**
   * Insert a new job or refresh a known one (idempotent: rerunning never duplicates).
   * A full description from a careers page replaces a snippet from an email, never the other way.
   */
  async upsertJob(j: NormalizedJob, companyId: string | null): Promise<{ id: string; inserted: boolean }> {
    const { rows } = await this.db.query<{ id: string; inserted: boolean }>(
      `insert into jobs (fingerprint, company_id, title, city, description, description_is_full, salary_text,
                         salary_min_aed, salary_max_aed, experience_min, visa_flags, posted_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       on conflict (fingerprint) do update set
         last_seen_at = now(),
         is_open = true,
         company_id = coalesce(jobs.company_id, excluded.company_id),
         city = coalesce(jobs.city, excluded.city),
         description = case
           when excluded.description_is_full and not jobs.description_is_full then excluded.description
           when jobs.description is null then excluded.description
           else jobs.description end,
         description_is_full = jobs.description_is_full or excluded.description_is_full,
         salary_text = coalesce(jobs.salary_text, excluded.salary_text),
         salary_min_aed = coalesce(jobs.salary_min_aed, excluded.salary_min_aed),
         salary_max_aed = coalesce(jobs.salary_max_aed, excluded.salary_max_aed),
         experience_min = coalesce(jobs.experience_min, excluded.experience_min),
         visa_flags = (select array(select distinct unnest(jobs.visa_flags || excluded.visa_flags))),
         posted_at = least(jobs.posted_at, excluded.posted_at)
       returning id, (xmax = 0) as inserted`,
      [
        j.fingerprint,
        companyId,
        j.title,
        j.city,
        j.description,
        j.descriptionIsFull,
        j.salaryText,
        j.salaryMinAed,
        j.salaryMaxAed,
        j.experienceMin,
        j.visaFlags,
        j.postedAt,
      ],
    );
    return rows[0]!;
  }

  /** userId null for shared sources (Jooble, ATS boards); set for a job found via one person's
   *  own Gmail alerts, so two users' sightings of the same job don't collide into one row. */
  async upsertSighting(jobId: string, sourceId: string, url: string, externalId: string, userId: string | null = null): Promise<void> {
    await this.db.query(
      `insert into job_sightings (job_id, source_id, url, external_id, user_id) values ($1, $2, $3, $4, $5)
       on conflict (job_id, source_id, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid))
       do update set last_seen_at = now(), url = excluded.url`,
      [jobId, sourceId, url, externalId, userId],
    );
  }

  async linkRaw(rawId: string, jobId: string): Promise<void> {
    await this.db.query(`update raw_listings set job_id = $2 where id = $1`, [rawId, jobId]);
  }

  async setJobSkills(jobId: string, skillIds: number[]): Promise<void> {
    if (skillIds.length === 0) return;
    await this.db.query(
      `insert into job_skills (job_id, skill_id) select $1, unnest($2::int[]) on conflict do nothing`,
      [jobId, skillIds],
    );
  }

  // ---------------------------------------------------------------- matching

  /** Recent jobs this user has never been matched against. */
  async unmatchedJobs(userId: string, days = 30): Promise<JobForMatching[]> {
    const { rows } = await this.db.query(
      `select j.id, j.title, c.name as company, j.city, j.description, j.experience_min, j.visa_flags,
              j.posted_at, j.first_seen_at,
              coalesce(array_agg(s.name) filter (where s.name is not null), '{}') as skills
       from jobs j
       left join companies c on c.id = j.company_id
       left join job_skills js on js.job_id = j.id
       left join skills s on s.id = js.skill_id
       where j.is_open and j.first_seen_at >= now() - make_interval(days => $2)
         and not exists (select 1 from job_matches m where m.job_id = j.id and m.user_id = $1)
       group by j.id, c.name`,
      [userId, days],
    );
    return rows.map(toJobForMatching);
  }

  async insertMatch(userId: string, jobId: string, r: PrefilterResult): Promise<void> {
    await this.db.query(
      `insert into job_matches (user_id, job_id, prefilter_passed, prefilter_reason, quick_score)
       values ($1, $2, $3, $4, $5) on conflict (user_id, job_id) do nothing`,
      [userId, jobId, r.passed, r.reason, r.quickScore],
    );
  }

  /**
   * Passed the filter but not scored yet, best quick score first. Jobs that only got a
   * heuristic score on an earlier day come back too, so AI can score them once it's available.
   * Jobs previously AI-scored under a different profile (new skills, CV, highlight project...)
   * come back too, so a profile edit doesn't leave stale scores forever.
   */
  async toScore(
    userId: string,
    limit: number,
    profileHash: string,
  ): Promise<Array<JobForMatching & { matchId: string; quickScore: number; hasHeuristic: boolean }>> {
    const { rows } = await this.db.query(
      `select m.id as match_id, m.quick_score, (m.model = 'heuristic') as has_heuristic,
              j.id, j.title, c.name as company, j.city, j.description,
              j.experience_min, j.visa_flags, j.posted_at, j.first_seen_at,
              coalesce(array_agg(s.name) filter (where s.name is not null), '{}') as skills
       from job_matches m
       join jobs j on j.id = m.job_id
       left join companies c on c.id = j.company_id
       left join job_skills js on js.job_id = j.id
       left join skills s on s.id = js.skill_id
       where m.user_id = $1 and m.prefilter_passed and m.dismissed_at is null
         and (m.scored_at is null
              or (m.model = 'heuristic' and m.scored_at < date_trunc('day', now()))
              or (m.model is not null and m.model <> 'heuristic' and m.input_hash is distinct from $3))
         and j.first_seen_at >= now() - interval '14 days'
       group by m.id, j.id, c.name
       order by (m.scored_at is null) desc, m.quick_score desc nulls last, j.first_seen_at desc
       limit $2`,
      [userId, limit, profileHash],
    );
    return rows.map((r) => ({
      ...toJobForMatching(r),
      matchId: r.match_id,
      quickScore: r.quick_score ?? 0,
      hasHeuristic: Boolean(r.has_heuristic),
    }));
  }

  async saveScore(
    matchId: string,
    s: { score: number; reasons: string[]; missingSkills: string[]; visaNote: string | null; model: string; inputHash?: string | null },
  ): Promise<void> {
    await this.db.query(
      `update job_matches set score = $2, reasons = $3, missing_skills = $4, visa_note = $5, model = $6, input_hash = $7, scored_at = now()
       where id = $1`,
      [matchId, s.score, JSON.stringify(s.reasons), s.missingSkills, s.visaNote, s.model, s.inputHash ?? null],
    );
  }

  /** How many AI scorings this user already got today (per-user daily cap). */
  async aiScoredToday(userId: string): Promise<number> {
    const { rows } = await this.db.query<{ n: string }>(
      `select count(*) as n from job_matches where user_id = $1 and model is not null and model <> 'heuristic'
         and scored_at >= date_trunc('day', now())`,
      [userId],
    );
    return Number(rows[0]?.n ?? 0);
  }

  // ---------------------------------------------------------------- AI usage (quota tracking)

  async aiRequestsToday(provider: string): Promise<number> {
    const { rows } = await this.db.query<{ n: string | null }>(
      `select sum(requests) as n from ai_usage where day = current_date and provider = $1`,
      [provider],
    );
    return Number(rows[0]?.n ?? 0);
  }

  async recordAiUsage(u: { provider: string; model: string; purpose: string; tokensIn: number; tokensOut: number; failed: boolean }): Promise<void> {
    await this.db.query(
      `insert into ai_usage (provider, model, purpose, requests, failures, tokens_in, tokens_out)
       values ($1, $2, $3, 1, $4, $5, $6)
       on conflict (day, provider, model, purpose) do update set
         requests = ai_usage.requests + 1,
         failures = ai_usage.failures + excluded.failures,
         tokens_in = ai_usage.tokens_in + excluded.tokens_in,
         tokens_out = ai_usage.tokens_out + excluded.tokens_out`,
      [u.provider, u.model, u.purpose, u.failed ? 1 : 0, u.tokensIn, u.tokensOut],
    );
  }

  // ---------------------------------------------------------------- drafts

  /**
   * Best scored jobs without drafts yet, that the user hasn't dismissed or closed. A cover note
   * written under a now-stale profile (hash mismatch) comes back too, unless the user edited it.
   */
  async toDraft(userId: string, minScore: number, limit: number, profileHash: string): Promise<Array<JobForMatching & { score: number; reasons: string[] }>> {
    const { rows } = await this.db.query(
      `select j.id, j.title, c.name as company, j.city, j.description, j.experience_min, j.visa_flags,
              j.posted_at, j.first_seen_at, m.score, m.reasons,
              coalesce(array_agg(s.name) filter (where s.name is not null), '{}') as skills
       from job_matches m
       join jobs j on j.id = m.job_id
       left join companies c on c.id = j.company_id
       left join job_skills js on js.job_id = j.id
       left join skills s on s.id = js.skill_id
       left join applications a on a.job_id = j.id and a.user_id = m.user_id
       where m.user_id = $1 and m.score >= $2 and m.dismissed_at is null
         and (a.id is null or a.status = 'saved')
         and not exists (
           select 1 from drafts d where d.user_id = m.user_id and d.job_id = j.id and d.type = 'cover_note'
             and (d.edited_by_user or d.input_hash is not distinct from $4)
         )
       group by j.id, c.name, m.score, m.reasons
       order by m.score desc
       limit $3`,
      [userId, minScore, limit, profileHash],
    );
    return rows.map((r) => ({ ...toJobForMatching(r), score: r.score, reasons: r.reasons ?? [] }));
  }

  /** Never overwrite a draft the user edited by hand. */
  async saveDraft(
    userId: string,
    jobId: string,
    type: 'cover_note' | 'outreach' | 'follow_up',
    content: string,
    model: string,
    inputHash: string | null = null,
  ): Promise<void> {
    await this.db.query(
      `insert into drafts (user_id, job_id, type, content, model, input_hash) values ($1, $2, $3, $4, $5, $6)
       on conflict (user_id, job_id, type) do update set content = excluded.content, model = excluded.model, input_hash = excluded.input_hash
       where not drafts.edited_by_user`,
      [userId, jobId, type, content, model, inputHash],
    );
  }

  // ---------------------------------------------------------------- follow-ups

  /** Applied, no change for N days: move to follow_up_due. Returns the applications moved. */
  async markFollowUpsDue(userId: string): Promise<string[]> {
    const { rows } = await this.db.query<{ id: string }>(
      `update applications set status = 'follow_up_due'
       where user_id = $1 and status = 'applied' and next_follow_up_at <= now()
       returning id`,
      [userId],
    );
    return rows.map((r) => r.id);
  }

  async followUpsWithoutDraft(userId: string): Promise<Array<{ jobId: string; title: string; company: string | null; appliedAt: Date | null }>> {
    const { rows } = await this.db.query(
      `select j.id as job_id, j.title, c.name as company, a.applied_at
       from applications a join jobs j on j.id = a.job_id left join companies c on c.id = j.company_id
       where a.user_id = $1 and a.status = 'follow_up_due'
         -- one follow-up draft per cycle: none written since the application last became due
         and not exists (
           select 1 from drafts d where d.user_id = a.user_id and d.job_id = a.job_id and d.type = 'follow_up'
             and d.updated_at >= coalesce((select max(e.at) from application_events e
                                           where e.application_id = a.id and e.to_status = 'follow_up_due'), a.created_at))`,
      [userId],
    );
    return rows.map((r) => ({ jobId: r.job_id, title: r.title, company: r.company, appliedAt: r.applied_at }));
  }

  // ---------------------------------------------------------------- digest

  async digestData(userId: string, topN: number, minScore = 0): Promise<{
    jobs: Array<{ id: string; title: string; company: string | null; city: string | null; score: number }>;
    followUps: Array<{ id: string; title: string; company: string | null; appliedAt: Date | null }>;
  }> {
    const jobs = await this.db.query(
      `select j.id, j.title, c.name as company, j.city, m.score
       from job_matches m join jobs j on j.id = m.job_id left join companies c on c.id = j.company_id
       left join applications a on a.job_id = j.id and a.user_id = m.user_id
       where m.user_id = $1 and m.score >= $3 and m.dismissed_at is null and a.id is null
         and m.created_at >= now() - interval '1 day'
       order by m.score desc limit $2`,
      [userId, topN, minScore],
    );
    const followUps = await this.db.query(
      `select a.id, j.title, c.name as company, a.applied_at
       from applications a join jobs j on j.id = a.job_id left join companies c on c.id = j.company_id
       where a.user_id = $1 and a.status = 'follow_up_due' order by a.applied_at`,
      [userId],
    );
    return {
      jobs: jobs.rows.map((r) => ({ id: r.id, title: r.title, company: r.company, city: r.city, score: r.score })),
      followUps: followUps.rows.map((r) => ({ id: r.id, title: r.title, company: r.company, appliedAt: r.applied_at })),
    };
  }

  async recordDigest(d: { userId: string; channel: string; jobIds: string[]; followUpIds: string[]; error?: string }): Promise<void> {
    await this.db.query(
      `insert into digests (user_id, channel, job_ids, followup_ids, ok, error) values ($1, $2, $3, $4, $5, $6)`,
      [d.userId, d.channel, d.jobIds, d.followUpIds, !d.error, d.error ?? null],
    );
  }

  async digestSentToday(userId: string): Promise<boolean> {
    const { rows } = await this.db.query(
      `select 1 from digests where user_id = $1 and ok and sent_at >= date_trunc('day', now()) limit 1`,
      [userId],
    );
    return rows.length > 0;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toJobForMatching(r: any): JobForMatching {
  return {
    id: r.id,
    title: r.title,
    company: r.company ?? null,
    city: r.city ?? null,
    description: r.description ?? null,
    experienceMin: r.experience_min ?? null,
    visaFlags: r.visa_flags ?? [],
    skills: r.skills ?? [],
    postedAt: r.posted_at ?? null,
    firstSeenAt: r.first_seen_at,
  };
}
