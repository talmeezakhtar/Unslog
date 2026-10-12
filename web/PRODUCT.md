# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A single primary user: the owner, actively job-hunting in the UAE (Dubai). They sign in themselves each morning, review what the pipeline found overnight, and decide what to act on. Built first for the owner's own job search; the codebase optionally supports a handful of additional named users via `ALLOWED_USER_IDS`, but the dashboard is designed around one person's daily routine, not a multi-tenant audience.

## Product Purpose

Unslog is a free, personal job-hunt copilot. Every morning an automated pipeline collects new UAE job postings (job-alert emails, the Jooble API, company careers pages), removes duplicates, filters them against the user's profile, scores the best matches with a free-tier AI model, and drafts a cover note and outreach note for each. The user reviews everything and sends it themselves — the product never applies or messages on their behalf. Success is: the user spends about 20 minutes a day on the Today page and doesn't miss good-fit openings or forget to follow up.

## Positioning

Most job-search tooling is either a job board (search, don't filter or draft) or a generic tracker (manual data entry, no sourcing). Unslog's mechanism is the full pipeline in one free, self-hosted tool: collect → dedupe → filter → score → draft → remind, running unattended on free-tier infrastructure (GitHub Actions, Supabase, Vercel, Gemini/Groq), with the user only in the loop to review and send.

## Operating Context

- Daily rhythm: pipeline runs every morning at a fixed time (08:00 Dubai time by default); user opens the dashboard once a day to review the digest.
- Core workflow pages: Today (daily digest / top matches), Jobs (full list, filterable), Job detail (fit score, AI "why it fits," drafts, contacts, application tracking), Pipeline (kanban-style stage board: Saved → Applied → Follow-up due → Interview → Offer → Closed), Outreach (drafted notes awaiting send), Insights (market/skill trends, personal funnel stats), Settings (profile: skills, target titles, cities, visa status, experience, sources, AI/digest config).
- Sign-in is required for every page except Sign In itself; without a session the user sees only the sign-in screen.
- Without any sources or AI keys configured, the product still runs: filtering uses free heuristic rules and drafts fall back to templates.
- Deployed to Vercel (dashboard) + GitHub Actions (pipeline) + Supabase (Postgres + auth with Row Level Security) — all free tiers.

## Capabilities and Constraints

- Dashboard is React 19 + Vite + TypeScript, plain CSS (tokens.css + app.css), no component library.
- Data source is Supabase Postgres via RLS-protected anon key in the browser; never the service_role key.
- The AI "why it fits" / draft text is model-generated from the job posting and the user's profile — must stay clearly distinguishable as AI output the user edits before sending, not final copy sent automatically.
- Visa status and residency rules are functionally significant (e.g. "UAE residents only" jobs are filtered for visit-visa holders) — not just cosmetic tags.
- Fit scores (0–100) and "why it fits" reasoning are central to how the user triages jobs on Today/Jobs/Job detail — these need to stay scannable and trustworthy-looking, not buried.

## Brand Commitments

Renamed from "Callback" to **Unslog** (user-provided rename, 2026-10-09), with a new mark: a rounded-square tile holding an up-right arrow and two underline bars (user-supplied brand sheet). The source sheet pairs the arrow in a second accent (signal orange) against an ink or orange tile; built instead as a single-accent mark — tile and arrow+bars both ride the app's one committed accent color (jet red) — to keep the system's existing One Accent Rule rather than introducing a second brand color. The mark's accent rides `var(--action)`/`var(--action-ink)` rather than fixed hex values (except the standalone `public/favicon.svg`, which can't read CSS custom properties and is hand-kept in sync). Wordmark text is "Unslog". Old name/mark are fully retired, not a visual-only reskin.

## Evidence on Hand

Real UI is implemented for all pages and screenshotted with sample data in `docs/images/` (today.png, job-detail.png, pipeline.png, insights.png) — these are the current/incumbent visual world. No real user data, testimonials, or case studies exist (this is a pre-launch personal tool); do not fabricate any.

## Product Principles

- One person's daily tool, not a sales surface: every screen should optimize for a fast, low-friction daily review, not for persuading a new visitor.
- The user stays in control: AI scores and drafts are suggestions to review/edit, never auto-sent — the UI should keep that boundary visually obvious.
- Trustworthy triage over decoration: fit scores, visa/residency flags, and salary data are decision-making signals first; style should make them easier to scan, not harder.
- Works with nothing configured: empty/unconfigured states (no AI key, no sources) are a normal, expected state, not an error condition, and should look intentional.
- Free-tier, personal-project honesty: no invented metrics, testimonials, or enterprise-SaaS trust signals that don't apply to a single-user tool.
