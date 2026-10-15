import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import pg from 'pg';
import { AiRouter, type UsageStore } from '../src/ai/router.js';
import type { Completion, LlmProvider, Prompt, Purpose } from '../src/ai/types.js';
import type { Collector, CollectorResult, RawJob } from '../src/collectors/types.js';
import { loadConfig } from '../src/config.js';
import type { Db } from '../src/db/client.js';
import { Repo } from '../src/db/repo.js';
import { runPipeline } from '../src/run.js';
import { TEST_DATABASE_URL, createUser, freshDatabase } from './support/db.js';

process.env.LOG_LEVEL = 'silent';

/** A collector that returns fixed jobs, standing in for Gmail / Jooble / an ATS. */
class FakeCollector implements Collector {
  readonly sourceKeys: string[];
  constructor(
    readonly name: string,
    private readonly result: CollectorResult | Error,
  ) {
    this.sourceKeys = result instanceof Error ? [name] : result.sources.map((s) => s.key);
  }
  isConfigured() {
    return true;
  }
  async collect() {
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

/** A deterministic "AI": scores by whether the posting mentions Node.js, writes short drafts. */
class FakeAi implements LlmProvider {
  readonly name = 'fake';
  readonly dailyLimit = 1000;
  readonly minIntervalMs = 0;
  calls = 0;
  model() {
    return 'fake-1';
  }
  async complete(p: Prompt, purpose: Purpose): Promise<Completion> {
    this.calls++;
    if (purpose === 'score') {
      const score = /node\.js/i.test(p.user) ? 91 : 55;
      return { text: JSON.stringify({ score, reasons: ['Fake reason'], missing_skills: [], visa_note: null }), tokensIn: 100, tokensOut: 20 };
    }
    return { text: p.user.includes('280 characters') ? 'Hi [Name], short note.' : 'A tailored cover note.', tokensIn: 100, tokensOut: 30 };
  }
}

const job = (over: Partial<RawJob>): RawJob => ({
  sourceKey: 'gmail:indeed',
  externalId: 'x',
  url: 'https://example.com/x',
  title: 'Backend Developer',
  company: 'Acme Technologies LLC',
  location: 'Dubai',
  description: 'Node.js, PostgreSQL and Docker. 1+ years.',
  postedAt: new Date(),
  raw: { fixture: true },
  ...over,
});

const emailJobs: CollectorResult = {
  sources: [{ key: 'gmail:indeed', name: 'Indeed (email alerts)', kind: 'email' }],
  jobs: [
    job({ externalId: 'jk1', url: 'https://ae.indeed.com/viewjob?jk=jk1' }),
    job({ externalId: 'jk2', title: 'Senior Java Architect', company: 'BigCorp', description: 'Java, 10+ years', url: 'https://ae.indeed.com/viewjob?jk=jk2' }),
    job({ externalId: 'jk3', title: 'React Developer', company: 'Pixel FZ-LLC', location: 'Abu Dhabi', description: 'React', url: 'https://ae.indeed.com/viewjob?jk=jk3' }),
  ],
};

// The same Acme opening again, from a company careers page, with the full description.
const atsJobs: CollectorResult = {
  sources: [{ key: 'ats:lever:acme', name: 'Acme careers (lever)', kind: 'ats' }],
  jobs: [
    job({
      sourceKey: 'ats:lever:acme',
      externalId: 'lever-1',
      url: 'https://jobs.lever.co/acme/lever-1',
      company: 'ACME TECHNOLOGIES L.L.C.',
      title: 'Backend Developer (Urgent)',
      description: 'Full description: Node.js, PostgreSQL, Docker, Kubernetes. 1+ years. Visa will be provided.',
      descriptionIsFull: true,
    }),
  ],
};

describe('pipeline end to end (real Postgres)', { skip: !TEST_DATABASE_URL && 'set TEST_DATABASE_URL to run database tests' }, () => {
  let db: Db;
  let repo: Repo;
  let userId: string;
  let otherUserId: string;
  const config = loadConfig({ DATABASE_URL: TEST_DATABASE_URL ?? 'x', DRAFT_TOP_N: '10' } as NodeJS.ProcessEnv);

  before(async () => {
    db = await freshDatabase();
    repo = new Repo(db);
    userId = await createUser(db, 'usman@example.com');
    otherUserId = await createUser(db, 'someone@example.com');
    await db.query(
      `insert into profiles (user_id, full_name, skills, years_experience, target_titles, cities, visa_status, min_score)
       values ($1, 'Usman Ali', '{node, postgres, docker}', 1, '{backend developer}', '{Dubai,Sharjah}', 'visit', 60)`,
      [userId],
    );
  });

  after(async () => {
    await db?.close();
  });

  it('collects, dedupes, matches, scores and drafts in one run', async () => {
    const ai = new FakeAi();
    const usage: UsageStore = repo;
    const summary = await runPipeline(config, repo, {
      steps: ['collect', 'match', 'score', 'followups', 'draft'],
      collectors: [
        new FakeCollector('gmail', emailJobs),
        new FakeCollector('ats:lever:acme', atsJobs),
        new FakeCollector('jooble', new Error('network down')),
      ],
      ai: new AiRouter([ai], usage),
    });

    // One failing collector doesn't stop the others.
    assert.deepEqual(summary.collectors.map((c) => [c.name, c.status]), [['gmail', 'ok'], ['ats:lever:acme', 'ok'], ['jooble', 'failed']]);

    // 4 raw jobs, 3 real openings: the Acme job was seen on two sites.
    const jobs = await db.query(`select title, description_is_full, description, visa_flags from jobs order by title`);
    assert.equal(jobs.rows.length, 3);
    const acme = jobs.rows.find((r) => r.title === 'Backend Developer')!;
    assert.equal(acme.description_is_full, true, 'full careers-page description replaces the email snippet');
    assert.deepEqual(acme.visa_flags, ['sponsorship']);
    const sightings = await db.query(`select count(*)::int as n from job_sightings s join jobs j on j.id = s.job_id where j.title = 'Backend Developer'`);
    assert.equal(sightings.rows[0]!.n, 2);
    assert.equal((await db.query(`select count(*)::int as n from raw_listings`)).rows[0]!.n, 4);

    // Skills were tagged from the dictionary, and the profile's "node" was understood as Node.js.
    const skills = await db.query(`select s.name from job_skills js join skills s on s.id = js.skill_id join jobs j on j.id = js.job_id where j.title = 'Backend Developer' order by 1`);
    assert.deepEqual(skills.rows.map((r) => r.name), ['Docker', 'Kubernetes', 'Node.js', 'PostgreSQL']);

    // Pre-filter: Java architect (10+ years) and React in Abu Dhabi fail with reasons; Acme passes and gets AI-scored.
    const matches = await db.query(
      `select j.title, m.prefilter_passed, m.prefilter_reason, m.score, m.model from job_matches m join jobs j on j.id = m.job_id where m.user_id = $1 order by j.title`,
      [userId],
    );
    assert.deepEqual(
      matches.rows.map((r) => [r.title, r.prefilter_passed]),
      [['Backend Developer', true], ['React Developer', false], ['Senior Java Architect', false]],
    );
    assert.match(matches.rows[1]!.prefilter_reason, /Abu Dhabi/);
    assert.match(matches.rows[2]!.prefilter_reason, /10\+ years/);
    assert.equal(matches.rows[0]!.score, 91);
    assert.equal(matches.rows[0]!.model, 'fake/fake-1@score-v1');

    // Drafts for the top job, and AI usage was counted.
    const drafts = await db.query(`select type, content from drafts where user_id = $1 order by type`, [userId]);
    assert.deepEqual(drafts.rows.map((r) => r.type), ['cover_note', 'outreach']);
    const usageRows = await db.query(`select purpose, requests from ai_usage order by purpose`);
    assert.deepEqual(usageRows.rows.map((r) => [r.purpose, r.requests]), [['draft', 2], ['score', 1]]);

    // Runs were logged per collector.
    const runs = await db.query(`select collector, status, found, new_count from collector_runs order by started_at`);
    assert.deepEqual(runs.rows.map((r) => [r.collector, r.status]), [['gmail', 'success'], ['ats:lever:acme', 'success'], ['jooble', 'failed']]);
  });

  it('is idempotent: running again creates nothing new', async () => {
    const ai = new FakeAi();
    await runPipeline(config, repo, {
      steps: ['collect', 'match', 'score', 'draft'],
      collectors: [new FakeCollector('gmail', emailJobs), new FakeCollector('ats:lever:acme', atsJobs)],
      ai: new AiRouter([ai], repo),
    });
    assert.equal((await db.query(`select count(*)::int as n from jobs`)).rows[0]!.n, 3);
    assert.equal((await db.query(`select count(*)::int as n from job_sightings`)).rows[0]!.n, 4);
    assert.equal((await db.query(`select count(*)::int as n from job_matches`)).rows[0]!.n, 3);
    assert.equal(ai.calls, 0, 'nothing new to score or draft');
  });

  it('falls back to heuristic scores and template drafts without AI', async () => {
    await runPipeline(config, repo, {
      steps: ['collect', 'match', 'score', 'draft'],
      collectors: [new FakeCollector('jooble', { sources: [{ key: 'jooble', name: 'Jooble', kind: 'api' }], jobs: [job({ sourceKey: 'jooble', externalId: 'j9', company: 'Nimbus', title: 'Node.js Backend Developer', url: 'https://jooble.org/9' })] })],
      ai: new AiRouter([], repo),
    });
    const m = await db.query(
      `select m.score, m.model from job_matches m join jobs j on j.id = m.job_id where j.title = 'Node.js Backend Developer' and m.user_id = $1`,
      [userId],
    );
    assert.equal(m.rows[0]!.model, 'heuristic');
    assert.ok(m.rows[0]!.score >= 60);
    const d = await db.query(
      `select d.model, d.content from drafts d join jobs j on j.id = d.job_id where j.title = 'Node.js Backend Developer' and d.type = 'cover_note'`,
    );
    assert.equal(d.rows[0]!.model, 'template');
    assert.match(d.rows[0]!.content, /Node\.js Backend Developer role in Dubai/);
  });

  it('logs application status changes and schedules follow-ups with a trigger', async () => {
    const { rows } = await db.query(`select id from jobs where title = 'Backend Developer'`);
    const jobId = rows[0]!.id;
    const app = await db.query(`insert into applications (user_id, job_id, status) values ($1, $2, 'saved') returning id`, [userId, jobId]);
    const appId = app.rows[0]!.id;
    await db.query(`update applications set status = 'applied', applied_at = now() - interval '7 days' where id = $1`, [appId]);

    const a = await db.query(`select next_follow_up_at > applied_at as scheduled from applications where id = $1`, [appId]);
    assert.equal(a.rows[0]!.scheduled, true);
    const events = await db.query(`select from_status, to_status from application_events where application_id = $1 order by at`, [appId]);
    assert.deepEqual(events.rows.map((r) => [r.from_status, r.to_status]), [[null, 'saved'], ['saved', 'applied']]);

    // Applied 7 days ago with a 6-day rule: the follow-up step marks it due and drafts a nudge.
    const summary = await runPipeline(config, repo, { steps: ['followups', 'draft'], collectors: [], ai: new AiRouter([], repo) });
    assert.equal(summary.users.find((u) => u.userId === userId)!.followUps, 1);
    const status = await db.query(`select status from applications where id = $1`, [appId]);
    assert.equal(status.rows[0]!.status, 'follow_up_due');
    const nudge = await db.query(`select content from drafts where user_id = $1 and job_id = $2 and type = 'follow_up'`, [userId, jobId]);
    assert.match(nudge.rows[0]!.content, /follow up/);

    // You nudge them and move it back to Applied: the next check-in counts from today, not from the
    // original application date, so it is not immediately due again.
    await db.query(`update applications set status = 'applied' where id = $1`, [appId]);
    const next = await db.query(`select next_follow_up_at > now() + interval '5 days' as later, status from applications where id = $1`, [appId]);
    assert.equal(next.rows[0]!.later, true);
    await runPipeline(config, repo, { steps: ['followups'], collectors: [], ai: new AiRouter([], repo) });
    assert.equal((await db.query(`select status from applications where id = $1`, [appId])).rows[0]!.status, 'applied');

    // A second cycle gets a fresh follow-up draft.
    await db.query(`update applications set next_follow_up_at = now() - interval '1 minute' where id = $1`, [appId]);
    await db.query(`update drafts set updated_at = now() - interval '1 day' where user_id = $1 and job_id = $2 and type = 'follow_up'`, [userId, jobId]);
    await runPipeline(config, repo, { steps: ['followups', 'draft'], collectors: [], ai: new AiRouter([], repo) });
    const fresh = await db.query(`select updated_at > now() - interval '1 minute' as fresh from drafts where user_id = $1 and job_id = $2 and type = 'follow_up'`, [userId, jobId]);
    assert.equal(fresh.rows[0]!.fresh, true);
  });

  it('serves only ALLOWED_USER_IDS when set', async () => {
    await db.query(`insert into profiles (user_id, skills) values ($1, '{java}') on conflict do nothing`, [otherUserId]);
    const only = loadConfig({ DATABASE_URL: TEST_DATABASE_URL ?? 'x', ALLOWED_USER_IDS: userId } as NodeJS.ProcessEnv);
    const summary = await runPipeline(only, repo, { steps: ['match'], collectors: [], ai: new AiRouter([], repo) });
    assert.deepEqual(summary.users.map((u) => u.userId), [userId]);
    await db.query(`delete from profiles where user_id = $1`, [otherUserId]);
  });

  it('never overwrites a draft the user edited', async () => {
    const { rows } = await db.query(`select job_id from drafts where user_id = $1 and type = 'cover_note' limit 1`, [userId]);
    await db.query(`update drafts set content = 'My own words', edited_by_user = true where user_id = $1 and job_id = $2 and type = 'cover_note'`, [userId, rows[0]!.job_id]);
    await repo.saveDraft(userId, rows[0]!.job_id, 'cover_note', 'AI rewrite', 'fake');
    const d = await db.query(`select content from drafts where user_id = $1 and job_id = $2 and type = 'cover_note'`, [userId, rows[0]!.job_id]);
    assert.equal(d.rows[0]!.content, 'My own words');
  });

  it('Row Level Security: users see shared jobs but only their own data', async () => {
    const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
    await client.connect();
    const as = async (uid: string, sql: string, params: unknown[] = []) => {
      await client.query('begin');
      try {
        await client.query(`set local role authenticated`);
        await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]);
        return await client.query(sql, params);
      } finally {
        await client.query('rollback');
      }
    };
    try {
      assert.equal((await as(otherUserId, `select count(*)::int as n from jobs`)).rows[0]!.n, 4, 'jobs are shared');
      assert.equal((await as(otherUserId, `select count(*)::int as n from job_matches`)).rows[0]!.n, 0, "can't see another user's matches");
      assert.equal((await as(otherUserId, `select count(*)::int as n from profiles`)).rows[0]!.n, 0);
      assert.equal((await as(userId, `select count(*)::int as n from profiles`)).rows[0]!.n, 1);
      assert.equal((await as(userId, `select count(*)::int as n from drafts`)).rows[0]!.n > 0, true);

      // Users may dismiss a match but not rewrite its score.
      const dismissed = await as(userId, `update job_matches set dismissed_at = now() where user_id = $1 returning id`, [userId]);
      assert.ok(dismissed.rows.length > 0);
      await assert.rejects(as(userId, `update job_matches set score = 100 where user_id = $1`, [userId]), /permission denied/);

      // Signed-out visitors (anon) can't call dashboard functions.
      await client.query('begin');
      await client.query('set local role anon');
      await assert.rejects(client.query('select ai_usage_today()'), /permission denied/);
      await client.query('rollback');

      // Raw data and AI usage are pipeline-only.
      assert.equal((await as(userId, `select count(*)::int as n from raw_listings`)).rows[0]!.n, 0);

      // Writing someone else's row is refused.
      await assert.rejects(as(otherUserId, `insert into contacts (user_id, name) values ($1, 'x')`, [userId]), /row-level security/);

      // user_secrets has no policy of its own any more: reads and writes only work through
      // the functions below, even for the row's own owner.
      assert.equal((await as(userId, `select count(*)::int as n from user_secrets`)).rows[0]!.n, 0);

      // BYOK keys and the Gmail token round-trip through the encrypting functions. One
      // transaction (not the as() helper, which rolls back) so the writes stick around to check.
      await client.query('begin');
      try {
        await client.query('set local role authenticated');
        await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId]);
        await client.query(`select set_byok_secrets($1, $2, $3)`, ['jooble-key', 'gemini-key', null]);
        await client.query(`select set_gmail_refresh_token($1)`, ['refresh-token-xyz']);
        const byok = (await client.query(`select * from get_byok_secrets()`)).rows[0]!;
        assert.deepEqual(byok, { jooble_api_key: 'jooble-key', gemini_api_key: 'gemini-key', groq_api_key: null });
        await client.query('commit');
      } catch (err) {
        await client.query('rollback');
        throw err;
      }

      // Stored encrypted, not in the clear — checked as the table owner, same access raw SQL would have.
      const raw = (await db.query(`select jooble_api_key, gmail_refresh_token from user_secrets where user_id = $1`, [userId])).rows[0]!;
      assert.notEqual(raw.jooble_api_key.toString(), 'jooble-key');
      assert.notEqual(raw.gmail_refresh_token.toString(), 'refresh-token-xyz');

      // The pipeline (direct connection, same role that owns the key) decrypts them for real use.
      const pipelineSecrets = await repo.secrets(userId);
      assert.equal(pipelineSecrets.joobleApiKey, 'jooble-key');
      assert.equal(pipelineSecrets.gmailRefreshToken, 'refresh-token-xyz');

      // Dashboard functions work for the signed-in user.
      const today = await as(userId, `select today_summary() as s`);
      assert.equal(typeof today.rows[0]!.s.new_jobs_today, 'number');
      const top = await as(userId, `select * from insights_top_skills(30, 5)`);
      assert.ok(top.rows.length > 0);
    } finally {
      await client.end();
    }
  });
});
