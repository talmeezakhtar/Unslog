# Learning guide

Callback was built to be used every morning and to be learned from. This guide maps the code to
the skills it teaches, in the order to read it, with exercises and interview talking points.

## Reading order

| # | Read | You'll learn |
| --- | --- | --- |
| 1 | `supabase/migrations/20261008000000_init.sql` | Table design, primary/foreign keys, unique constraints, enums, indexes, triggers, RLS policies, SQL functions |
| 2 | `pipeline/src/collectors/types.ts`, `jooble.ts`, `ats.ts` | Interfaces, the Strategy pattern, mapping external JSON into your own types |
| 3 | `pipeline/src/lib/http.ts` | async/await, timeouts with AbortController, retries, exponential backoff, rate limiting |
| 4 | `pipeline/src/collectors/gmail/` | OAuth 2.0 refresh tokens, the Gmail REST API, parsing HTML into a DOM |
| 5 | `pipeline/src/stages/dedupe.ts`, `enrich.ts`, `normalize.ts` | Normalization, hashing, regular expressions |
| 6 | `pipeline/src/db/repo.ts` | Parameterized SQL, upserts (`on conflict`), joins, aggregates, the Repository pattern |
| 7 | `pipeline/src/ai/` | Calling REST APIs, the Adapter pattern, fallback, circuit breakers, schema validation, prompt design |
| 8 | `pipeline/src/run.ts` | Orchestration, failure isolation, dependency injection for tests |
| 9 | `pipeline/test/` | Unit tests, fixtures, test doubles, end-to-end tests against a real database |
| 10 | `web/src/lib/api.ts`, `hooks.tsx`, `pages/` | React state and effects, custom hooks, controlled forms, auth sessions |

## Exercises (do them in order)

1. **SQL.** In the Supabase SQL editor, write a query for "companies that posted 3+ jobs this
   month that mention Node.js". Then compare yours with `insights_top_companies`.
2. **Add a skill.** Insert "NestJS" variants into `skills.aliases`, run the pipeline, and check
   `job_skills`.
3. **New pre-filter rule.** Skip jobs older than N days (a profile setting). You'll touch a
   migration, `Profile` types, `prefilter.ts`, a test and the Settings page.
4. **New collector.** Add another public source behind the `Collector` interface, with a mapper test.
5. **Ollama provider.** Implement `LlmProvider` for a local model and put it first in `ai/index.ts`.
6. **Spring Boot rewrite (big).** Re-implement `Repo` + the match/score stages as a Spring Boot
   service with JPA entities for `jobs`, `job_matches` and `applications`, run it in Docker, and
   keep the same database. See the [roadmap](12-roadmap.md).

## Interview talking points

Practise each as a 60-second answer.

1. **The problem.** "I was job hunting in Dubai, so I built a tool that finds, ranks and tracks
   jobs for me every morning. I use it daily." Then your numbers: jobs reviewed per week,
   applications, reply rate (all on the Insights page).
2. **Collecting legally and reliably.** "Most job boards have no public API and forbid scraping,
   so I parse the alert emails they send me, use Jooble's official API, and read public ATS job
   feeds. Each source is a plugin behind one interface."
3. **Deduplication.** "The same job shows up on three sites with different URLs. I canonicalize
   links and fingerprint each job by normalized company, title and city, so one opening is one row
   with several sightings."
4. **Idempotency.** "Every write is an upsert on a natural key, so rerunning the pipeline never
   creates duplicates. I have a test that runs it twice."
5. **Cost.** "Free rules filter every job first; only the best 30 a day go to the AI. Usage is
   tracked in a table so we stay inside free tiers. Without AI it falls back to a heuristic score."
6. **Reliability.** "Retries with backoff, a fallback provider, a circuit breaker after a 429, and
   failure isolation: one broken source doesn't stop the run."
7. **Security.** "The browser talks to Postgres through Supabase with Row Level Security. Users
   can dismiss a match but can't edit its score, enforced with column grants. History is written
   by a trigger, so it can't be forged."
8. **AI safety.** "Job ads are untrusted input. I fence them in the prompt, validate the output
   against a schema, and never send anything automatically."
9. **Data model.** "Jobs are shared; matches are per user, because fit is personal. That's what
   makes it multi-tenant."
10. **What I'd do next.** Queue-based workers, per-user AI keys, a Spring Boot backend in Docker.

## Questions an interviewer might ask, and where the answer is

| Question | Look at |
| --- | --- |
| How do you avoid duplicate jobs? | `stages/dedupe.ts`, `jobs.fingerprint`, ADR 0005 |
| What happens if Gemini is down? | `ai/router.ts`, `test/ai.test.ts` |
| How do you stop one user reading another's data? | RLS policies in the migration, the RLS test |
| Why no backend server? | ADR 0002, ADR 0003 |
| Why not just scrape LinkedIn? | ADR 0004, docs/08 |
| How would this scale to 10,000 users? | docs/05, "How it would scale" |
| How do you test code that calls external APIs? | Fake collectors and scripted AI providers in `test/` |
