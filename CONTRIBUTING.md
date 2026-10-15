# Contributing

Thanks for helping. Unslog is a small codebase on purpose: please keep it readable.

## Setup

See [docs/01-getting-started.md](docs/01-getting-started.md). For tests you also need a local
Postgres (see [docs/09-testing.md](docs/09-testing.md)).

## Before you open a pull request

```bash
npm run typecheck
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/unslog_test npm test
npm run build
```

CI runs the same three commands.

## Guidelines

- **SQL lives in `pipeline/src/db/repo.ts`** (pipeline) and **queries in `web/src/lib/api.ts`** (dashboard).
- **Schema changes:** add a new migration file; never edit one that has been applied.
- **New sources** implement `Collector`; **new AI providers** implement `LlmProvider`. Each comes with tests.
- **No secrets** in code, fixtures or logs. Anonymize any real email you turn into a fixture.
- **Respect sources' terms:** no scraping of sites that forbid it, no logging in as users.
- Plain language in UI copy and docs: say what a button does ("Mark as applied"), not "Submit".

## Commit messages

Short imperative summary ("Add Workable collector"), with a body explaining why if it isn't obvious.
