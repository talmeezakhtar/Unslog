# 0002. A scheduled batch job instead of a server

**Status:** Accepted, October 2026

## Context

New jobs need collecting once or twice a day. Nothing has to react in real time. The budget is zero.

## Decision

Run the pipeline as a GitHub Actions workflow on a cron schedule (`.github/workflows/daily.yml`),
plus a manual "Run workflow" button. No long-running server.

## Alternatives considered

- **An always-on server (e.g. a free-tier VM).** Idles 23 hours a day; free tiers sleep or expire.
- **Supabase Edge Functions on a schedule.** Possible, but short execution limits and a Deno
  runtime; the AI rate limits make runs take minutes.

## Consequences

- Free, and nothing to keep alive.
- Runs can start a few minutes late, and GitHub pauses schedules on repos inactive for 60 days.
- Anything interactive (e.g. "regenerate this draft now") would need a function or server later.
