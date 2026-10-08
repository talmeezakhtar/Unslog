# Security and privacy

## Secrets

| Secret | Lives in | Never in |
| --- | --- | --- |
| `DATABASE_URL` (full database access) | `.env`, GitHub Actions secret | The web app, git, logs |
| AI keys, Jooble key, Telegram token | `.env`, GitHub Actions secrets | The web app, git, logs |
| Gmail client secret and refresh token | `.env`, GitHub Actions secrets | Anywhere else. Treat the refresh token like a password |
| Supabase anon key | Web app (`VITE_SUPABASE_ANON_KEY`) | (public by design; RLS protects data) |
| Supabase service_role key | Not used | The web app, ever |

- `.env` is git-ignored. `.env.example` holds names only.
- Keys in URLs (Jooble puts its key in the path) are redacted before logging (`redact()` in
  `lib/http.ts`). The Gemini key goes in a header.
- Leaked a key? Revoke it at the provider, create a new one, and update `.env` and the GitHub
  secret. For Gmail, remove access at <https://myaccount.google.com/permissions> and rerun
  `npm run gmail:auth`.

## Who can see what

The browser connects with the public anon key plus the signed-in user's session. Row Level
Security on every table decides the rest:

| Data | Signed-in user can |
| --- | --- |
| Jobs, companies, sightings, skills, sources, collector runs | Read |
| Raw listings, AI usage | Nothing (pipeline only; AI usage only as an aggregate count via a function, for signed-in users) |
| Own profile, searches, contacts, drafts, applications, interviews, outreach | Read and write |
| Own matches | Read; change only `dismissed_at` (scores can't be edited) |
| Own application history, digests | Read only |
| Anyone else's per-user rows | Nothing |

Signed-out visitors (`anon`) get nothing: no table policies apply to them, and dashboard functions
are granted to signed-in users only.

**Sign-ups.** Supabase lets anyone create an account by default. Every account can read shared job
data, and the pipeline processes every profile. For personal use, turn off new sign-ups after
creating your account and set `ALLOWED_USER_IDS` (see [Getting started, step 8](01-getting-started.md#8-schedule-the-pipeline-and-deploy-the-dashboard)).

These rules are tested against a real Postgres in `pipeline/test/pipeline.db.test.ts`.

The pipeline connects as the database owner, which bypasses RLS. That's why `DATABASE_URL`
must stay out of the browser.

**TLS to the database.** Supabase connections are encrypted. If `DATABASE_URL` has no
`sslmode`, the pipeline encrypts without verifying the server certificate. To verify it,
download the CA certificate from Supabase (Project Settings → Database → SSL configuration) and
append `?sslmode=verify-full&sslrootcert=/path/to/prod-ca-2021.crt` to the URL.

## What data goes where

| Data | Sent to | Why |
| --- | --- | --- |
| Job-alert emails (read-only) | Your database (as job rows + raw copies) | Collecting jobs |
| Your profile and CV text, plus job postings | Gemini or Groq | Scoring and drafts |
| Job titles and companies in the digest | Telegram or your email | Morning digest |
| Your Supabase data | Supabase (hosted in the region you chose) | Storage |

**Gemini free tier:** Google may use prompts and responses to improve its products, and human
reviewers may read them. Groq's terms differ; read them. Fine for your own search. Not fine for
other people's CVs: before inviting other users, switch to a paid/no-training tier, a local
model (Ollama) or per-user keys ([roadmap](12-roadmap.md)).

**Contacts:** store only what people share publicly for work (name, role, LinkedIn profile, work
email). Don't build profiles of private individuals.

**Gmail scopes:** `gmail.readonly` reads alert emails; `gmail.send` only if you want the digest
by email. The collector only searches mail from the four job sites, and stores only the job
links and nearby text, not whole emails. The `npm run gmail:sample` helper does save whole
emails, into a git-ignored folder, for tuning parsers.

## Multi-user caveats (before you open it to others)

The MVP is designed for one owner who runs the pipeline, with RLS already isolating users:

- Sign-ups are meant to be closed and `ALLOWED_USER_IDS` set; opening them needs the items below.
- Gmail collection and the email digest use the owner's Gmail. Other users should use Telegram,
  or the email digest should move to a transactional email service.
- AI keys are instance-wide. Move to per-user keys stored encrypted (e.g. Supabase Vault).
- Sources are instance-wide and read-only to users; target companies are per user.
- Add rate limits on sign-ups, and terms and privacy pages.

## Responsible collection

Callback reads emails that sites send you, calls Jooble's documented API, and reads job lists
that companies publish publicly through their applicant tracking systems. It doesn't scrape job
boards, log in as you, or submit applications. It identifies itself with a User-Agent and waits
between requests. Before adding a source, read its terms.

## Reporting a problem

Found a security issue? Please open a private security advisory on the GitHub repository
instead of a public issue.
