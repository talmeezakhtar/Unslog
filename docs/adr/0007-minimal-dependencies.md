# 0007. Keep dependencies minimal

**Status:** Accepted, October 2026

## Context

Every dependency is something to install, update, audit and learn. Node 22 now ships a test
runner, `.env` loading, `fetch` and `AbortController`.

## Decision

- **Pipeline:** `pg`, `zod`, and `htmlparser2` + `domutils` + `domhandler` for email HTML.
  Node's built-in test runner instead of a framework, `process.loadEnvFile` instead of dotenv,
  `fetch` instead of an HTTP library, plain SQL instead of an ORM.
- **Dashboard:** React, Supabase's client and Vite. A ~60-line router and hand-rolled SVG charts
  instead of routing and chart libraries.

## Consequences

- Small install, fewer security advisories, and code a learner can read end to end.
- If the dashboard grows past ~10 pages, swap the tiny router for react-router; if charts get
  complex, adopt a chart library.
