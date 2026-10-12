# Architecture

Callback is two programs that share one database: a **pipeline** that runs on a schedule and
writes jobs, scores and drafts, and a **dashboard** where you read them and record what you do.
There is no always-on server.

```mermaid
flowchart LR
  subgraph Sources
    G[Gmail job alerts<br/>Indeed, LinkedIn, Bayt, Naukrigulf]
    J[Jooble API]
    A[Company careers pages<br/>Greenhouse, Lever, Ashby, Workable, SmartRecruiters]
  end
  subgraph GitHub Actions, daily 08:00 Dubai
    P[Pipeline<br/>Node.js + TypeScript]
  end
  subgraph AI free tiers
    GE[Gemini]
    GR[Groq]
  end
  DB[(Supabase Postgres<br/>+ Row Level Security)]
  W[Dashboard<br/>React on Vercel]
  T[Telegram / Email digest]

  G --> P
  J --> P
  A --> P
  P <--> GE
  P <--> GR
  P -->|SQL as table owner| DB
  W -->|anon key + your session, RLS applies| DB
  P --> T
```

## Components

| Component | Runs where | Talks to | Responsibility |
| --- | --- | --- | --- |
| Pipeline | GitHub Actions (or your machine) | Sources, AI, Postgres, Telegram/Gmail | Collect, dedupe, enrich, filter, score, draft, follow-ups, digest |
| Database | Supabase | Pipeline, dashboard | Single source of truth; RLS decides who sees what; triggers keep history |
| Dashboard | Vercel (static files) | Supabase (REST + auth) | Review jobs, edit drafts, track applications and outreach, settings |

Why this shape: the pipeline only needs to run once a day, so a scheduled job is cheaper and
simpler than a server ([ADR 0002](adr/0002-scheduled-batch-instead-of-server.md)). The dashboard
reads Supabase directly, protected by RLS, so there is no API layer to write or host
([ADR 0003](adr/0003-supabase-with-rls.md)).

## Folder layout

```
callback/
├── .github/workflows/
│   ├── daily.yml            # the morning run
│   └── ci.yml               # typecheck, tests (real Postgres), web build
├── supabase/migrations/     # the whole database: tables, RLS, triggers, functions, skills
├── pipeline/
│   ├── src/
│   │   ├── index.ts         # CLI: npm run pipeline -- run [--steps ...]
│   │   ├── run.ts           # orchestrates the stages
│   │   ├── config.ts        # env vars, validated with Zod
│   │   ├── collectors/      # one class per source, all behind the Collector interface
│   │   │   ├── gmail/       #   Gmail client + alert email parsers
│   │   │   ├── jooble.ts
│   │   │   └── ats.ts       #   Greenhouse, Lever, Ashby, Workable, SmartRecruiters
│   │   ├── stages/          # normalize, dedupe, enrich, prefilter, score, draft, digest
│   │   ├── ai/              # providers (Gemini, Groq), router with fallback, prompts
│   │   ├── db/              # pg connection + Repo (all SQL lives here)
│   │   ├── lib/             # http with retries, text/HTML helpers, UAE locations, logging
│   │   └── scripts/         # gmail-auth, gmail-sample, migrate
│   └── test/                # node:test unit tests + end-to-end test on Postgres
├── web/
│   └── src/
│       ├── pages/           # Today, Jobs, JobDetail, Pipeline, Outreach, Insights, Settings, SignIn
│       ├── components/      # Layout, score tile, job rows, charts
│       ├── lib/             # api.ts (every query), router, supabase client, types
│       └── styles/          # tokens.css (restyle here) + app.css
└── docs/
```

## A day in the life of one job

1. **08:00.** GitHub starts `daily.yml`. The Gmail collector finds an Indeed alert email listing
   "Backend Developer, Acme Technologies LLC, Dubai".
2. The parser turns the link into a stable id (`jk=a1b2…`) and writes the untouched data to
   `raw_listings`.
3. `normalize` builds the common shape. `dedupe` computes the fingerprint
   `sha1("acme technologies|backend developer|dubai")`. It's new, so a `jobs` row is inserted, plus
   a `job_sightings` row for Indeed.
4. Ten minutes later the Acme Lever board returns the same job with the full description. Same
   fingerprint, so no new job: a second sighting is added and the snippet is replaced by the full
   text.
5. `enrich` tags Node.js, PostgreSQL and Docker, notes "visa provided", and reads "1+ years".
6. For each user, `prefilter` checks cities, experience, visa and blocked words, and writes a
   `job_matches` row with a quick score.
7. `score` sends the best candidates to Gemini, gets `{score: 91, reasons: [...]}` back,
   validates it, and saves it.
8. `draft` writes a cover note and an outreach note. `digest` sends the morning message.
9. **08:30.** You open Today, review, click **Mark as applied**. A database trigger stamps
   `applied_at`, schedules the follow-up for 6 days later, and logs the event.
10. **Day 7.** No reply. The pipeline moves the application to *Follow-up due* and drafts a nudge.
    You send it and click **I followed up**; the next check-in is scheduled from that day.

## Where to change things

| You want to… | Change |
| --- | --- |
| Add a job source | A new class implementing `Collector` in `pipeline/src/collectors/`, registered in `collectors/index.ts` |
| Add an AI provider | A class implementing `LlmProvider` in `pipeline/src/ai/`, added in `ai/index.ts` |
| Change scoring | `ai/prompts.ts` (AI) and `stages/prefilter.ts` (free rules) |
| Add a table or column | A new file in `supabase/migrations/`, then `npm run db:migrate` |
| Restyle the dashboard | `web/src/styles/tokens.css` |
| Add a skill | A row in the `skills` table (or a new migration) |
