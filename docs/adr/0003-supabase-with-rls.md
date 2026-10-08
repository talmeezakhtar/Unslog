# 0003. Supabase with Row Level Security, no API layer

**Status:** Accepted, October 2026

## Context

The dashboard needs auth, reads, and a few writes (status changes, drafts, contacts). Writing
and hosting a REST API would double the work.

## Decision

Use Supabase (Postgres + Auth + auto-generated REST). The browser uses the public anon key with
the user's session. Authorization lives in the database as RLS policies, column grants and
`security definer` triggers. The pipeline connects as the table owner with plain SQL.

## Alternatives considered

- **A NestJS or Spring Boot API in front of Postgres.** More control, but more code and hosting.
- **Firebase.** No SQL, which loses joins, constraints and triggers that this data model relies on.

## Consequences

- No API code; authorization rules are tested directly against Postgres.
- Business rules that must always hold (follow-up dates, event history) live in triggers.
- Users can only change what the grants allow, e.g. `dismissed_at` on matches but not `score`.
- Complex write workflows would eventually want server-side functions.
