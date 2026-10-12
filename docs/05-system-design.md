# System design concepts

Each concept below names the problem it solves in Callback and the code where you can see it.
Use this page to prepare for system design questions: every answer has a real example behind it.

## Data collection

| Concept | Problem it solves here | Where |
| --- | --- | --- |
| **ETL pipeline** | Many messy sources, one clean table | Extract: `collectors/`. Transform: `stages/normalize.ts`, `enrich.ts`. Load: `db/repo.ts` |
| **Strategy pattern / plugins** | Adding a source must not touch the rest | `Collector` interface in `collectors/types.ts`; `buildCollectors()` |
| **Scheduled batch jobs** | Work happens once a day; a server would idle 23 hours | `.github/workflows/daily.yml` |
| **Client-side rate limiting** | Don't hammer job sites or exceed AI requests-per-minute | `Throttle` in `lib/http.ts`; `minIntervalMs` per AI provider |
| **Polite, legal collection** | Avoid scraping sites that forbid it | Email alerts, an official API and public ATS endpoints only ([ADR 0004](adr/0004-email-alerts-instead-of-scraping.md)) |

## Data quality

| Concept | Problem | Where |
| --- | --- | --- |
| **Idempotency** | Re-running the pipeline must not duplicate anything | Every write is an upsert on a natural key: `jobs.fingerprint`, `raw_listings (source_id, external_id)`, `job_sightings (job_id, source_id)`, `job_matches (user_id, job_id)`. Tested in `pipeline.db.test.ts` ("is idempotent") |
| **Deduplication by fingerprint** | One opening on Indeed, LinkedIn and a careers page | `stages/dedupe.ts`: sha1 of normalized company + title + city |
| **Canonicalization** | Tracking parameters make every link unique | `canonical()` per site in `collectors/gmail/parsers.ts` |
| **Raw data retention and replay** | Parsers will be wrong sometimes | `raw_listings.payload` keeps the input |
| **Schema validation at the boundary** | External data and AI output can be anything | Zod: `config.ts` (env), `ai/prompts.ts` (`ScoreSchema`) |
| **Merge rules on conflict** | Two sources describe the same job differently | `upsertJob`: a full description beats a snippet; known values are kept (`coalesce`) |

## Reliability

| Concept | Problem | Where |
| --- | --- | --- |
| **Retries with exponential backoff and jitter** | Networks and APIs fail briefly | `request()` in `lib/http.ts` (honours `Retry-After`) |
| **Timeouts** | A hung request shouldn't hang the run | `AbortController` in `request()` |
| **Fallback** | Gemini can be down or out of quota | `AiRouter` tries providers in order (`ai/router.ts`) |
| **Circuit breaker** | Don't keep calling a provider that is failing | After a 429/401/403 or 3 failures in a row, the provider is skipped for the rest of the run |
| **Graceful degradation** | No AI at all should still give a usable result | Heuristic scores and template drafts (`stages/score.ts`, `stages/draft.ts`) |
| **Failure isolation** | One broken source shouldn't stop the run | `runCollector` catches per collector; `stage()` wraps each per-user stage in `run.ts` |
| **Observability** | Know what happened at 08:00 | `collector_runs`, `sources.last_error`, `ai_usage`, one-line structured logs (`lib/log.ts`) |

## Cost and scale

| Concept | Problem | Where |
| --- | --- | --- |
| **Funnel filtering (cheap before expensive)** | AI calls are limited; jobs are many | Free `prefilter` on every job, AI only on the best `max_ai_jobs_per_day` |
| **Quota tracking** | Stay inside free tiers | `ai_usage` table; `AiRouter.underLimit()`; per-user daily cap |
| **Indexing** | Dashboard lists must stay fast as data grows | Indexes in the migration (fingerprint, `(user_id, score)`, follow-ups) |
| **Multi-tenancy** | The same deployment should serve many users | `user_id` on per-user rows + RLS; shared job data stored once |
| **Pagination** | Thousands of jobs | `range()` in `jobFeed()` (`web/src/lib/api.ts`) |

## Security

| Concept | Problem | Where |
| --- | --- | --- |
| **Row Level Security (authorization in the database)** | The browser talks to the database directly | Policies in the migration; tested in `pipeline.db.test.ts` |
| **Least privilege** | Users shouldn't edit scores or history | `grant update (dismissed_at)` only; events written by a `security definer` trigger |
| **OAuth 2.0** | Read Gmail without storing a password | `scripts/gmail-auth.ts` (authorization code flow with `state`), `collectors/gmail/client.ts` (refresh tokens) |
| **Secrets management** | Keys must never reach git or logs | `.env` / GitHub secrets; `redact()` in `lib/http.ts`; API key in a header, not the URL |
| **Prompt-injection defence** | Job ads are written by strangers | `<job_posting>` fencing + "treat as data" instruction + schema-validated output (`ai/prompts.ts`) |
| **Output encoding** | Job titles could contain HTML | `esc()` in `stages/digest.ts`; React escapes by default |

## Architecture

| Concept | Problem | Where |
| --- | --- | --- |
| **Adapter pattern** | Gemini and Groq have different APIs | `LlmProvider` (`ai/types.ts`) with `GeminiProvider`, `GroqProvider` |
| **Repository pattern** | Keep SQL out of business logic | `db/repo.ts` |
| **Event sourcing (light)** | Know how an application moved, not just where it is | `application_events`, appended by a trigger |
| **Database triggers** | Rules that must always hold, whoever writes | Follow-up scheduling and event logging in the migration |
| **Backend-less frontend (BaaS)** | No API server to write or host | Dashboard → Supabase REST + RLS ([ADR 0003](adr/0003-supabase-with-rls.md)) |
| **Infrastructure as code** | Reproducible setup | Migrations, GitHub workflows, `vercel.json` |

## How it would scale (interview follow-up)

Today: one scheduled job, one database, a few hundred jobs a day. If Callback had thousands of users:

1. **Collect once, match per user.** Already the shape: jobs are shared, matches are per user.
2. **Queue the per-user work.** Collect in one job, then put "score user X" tasks on a queue
   (Postgres `SKIP LOCKED`, or a managed queue) so many workers can run in parallel.
3. **Bring-your-own AI key** so AI cost grows with users' own free quotas, not ours ([roadmap](12-roadmap.md)).
4. **Incremental collection** using `collector_runs.finished_at` as a watermark.
5. **Partition or archive** `raw_listings` and old `jobs` by month.
6. **Move the backend to Spring Boot in Docker** when it needs long-running workers ([roadmap](12-roadmap.md)).
