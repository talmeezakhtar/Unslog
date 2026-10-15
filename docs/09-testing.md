# Testing

Tests use Node's built-in test runner (`node:test` + `node:assert`), so there's no test
framework to install.

```bash
npm test                                   # unit tests; database tests are skipped
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/unslog_test npm test   # everything
npm run typecheck                          # pipeline + web
```

The database tests wipe and rebuild the database they're given, so the URL must contain "test".
Use a throwaway local Postgres:

```bash
docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=unslog_test postgres:16
```

## What's covered

| File | Covers |
| --- | --- |
| `test/parsers.test.ts` | Alert emails from Indeed, LinkedIn, Bayt (HTML) and Naukrigulf (plain text): titles, link canonicalization, company/location extraction, merging duplicate links, ignoring buttons and footers, non-job senders |
| `test/stages.test.ts` | HTML to text, whole-word skill matching (`java` ≠ `javascript`, `c#`, `.net`), UAE city detection, company/title normalization, fingerprints, visa phrases, experience, AED salary parsing, normalize, every pre-filter rule and the quick score |
| `test/collectors.test.ts` | Jooble and all five ATS mappers with sample payloads, board URLs, the Gmail query, key redaction |
| `test/ai.test.ts` | Router: validated JSON, retry on invalid output, fallback to the next provider, circuit breaker on 429, daily limits, no providers; JSON extraction; prompt fencing |
| `test/digest.test.ts` | HTML escaping in the digest, empty state, template drafts |
| `test/pipeline.db.test.ts` | **End to end on real Postgres** with the real migrations: collect from fake sources (one failing), dedupe across sites, full description replacing a snippet, skill tagging, pre-filter reasons, AI scores, drafts, usage tracking, run logging, **idempotent re-run**, heuristic and template fallback, the application trigger and follow-up flow, user edits preserved, and **Row Level Security** (users can't see or write each other's rows or edit scores) |

`test/support/supabase-stub.sql` creates the few things Supabase normally provides (the `auth`
schema, `auth.uid()`, roles), so the real migrations run on plain Postgres.

## CI

`.github/workflows/ci.yml` runs on every push and pull request: install, typecheck, the full
test suite against a Postgres 16 service container, and the web production build.

## Writing tests for new code

- **A new collector:** add a mapper test with a realistic sample payload in `collectors.test.ts`.
- **A parser fix:** add the (anonymized) email as a fixture in `test/fixtures/` and a test in
  `parsers.test.ts`. Real emails saved by `npm run gmail:sample` stay in the git-ignored
  `test/fixtures/private/`.
- **SQL changes:** extend `pipeline.db.test.ts`; it runs your migration from scratch.
- **AI changes:** use a scripted provider like `ScriptedProvider` in `ai.test.ts`. Tests never
  call real AI APIs.

## Manual checks before a release

- `npm run pipeline -- run` against your Supabase project, then open Today.
- `npm run gmail:sample` shows jobs for each site you have alerts on.
- Sign in on a phone and check that Today, Job detail and Pipeline are usable.
