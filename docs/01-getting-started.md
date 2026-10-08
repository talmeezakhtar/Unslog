# Getting started

This guide takes you from nothing to a working Callback: a dashboard you can sign in to and a
pipeline that runs every morning. Everything uses free tiers. Budget about an hour.

Only steps 1–3 are required. Each later step switches on one more source or feature, and the
pipeline skips whatever you haven't set up yet.

| Step | What you get | Required |
| --- | --- | --- |
| 1. Supabase project | Database, sign-in | Yes |
| 2. Install and migrate | Tables created | Yes |
| 3. Run the dashboard | Sign in, fill in your profile | Yes |
| 4. Gmail alerts | Jobs from Indeed, LinkedIn, Bayt, Naukrigulf | Recommended |
| 5. Jooble | Jobs from many UAE sites by keyword | Recommended |
| 6. AI keys | AI scores and drafts (else heuristic + templates) | Recommended |
| 7. Telegram | Morning digest on your phone | Optional |
| 8. Schedule and deploy | Runs every morning, dashboard online | Yes, eventually |

You need Node.js 22 (`node -v`) and a GitHub account. Starting from the zip file rather than a
GitHub repository? Do [Local setup and GitHub](00-local-setup-and-github.md) first.

---

## 1. Create a Supabase project

1. Sign up at [supabase.com](https://supabase.com) and create a new project (free plan). Pick a
   region close to the UAE and save the database password somewhere safe.
2. **Database connection string.** Click **Connect** at the top of the project page. Copy the
   **Session pooler** URI (it works from GitHub Actions, which has no IPv6). Replace
   `[YOUR-PASSWORD]` with your password. This is `DATABASE_URL`.
3. **API keys.** Project Settings → API Keys (older dashboards: Project Settings → API). Copy the
   **Project URL** (`VITE_SUPABASE_URL`) and the **anon** key, which newer dashboards call the
   **publishable** key (`VITE_SUPABASE_ANON_KEY`). It's safe in the browser because every table has
   Row Level Security. Never put the `service_role` / secret key in the web app.
4. **Sign-in URLs.** Authentication → URL Configuration. Set **Site URL** to
   `http://localhost:5173` for now (change it to your Vercel URL in step 8) and add
   `http://localhost:5173` to **Redirect URLs**.
5. **Google sign-in (optional; email links work without it).** In
   [Google Cloud Console](https://console.cloud.google.com/), create an OAuth client of type
   **Web application** with the redirect URI
   `https://<your-project-ref>.supabase.co/auth/v1/callback`. Then, in Supabase, open
   Authentication → Providers → Google, switch it on and paste the client id and secret.

## 2. Install and create the tables

```bash
git clone https://github.com/<you>/callback.git
cd callback
npm install
cp .env.example .env
```

Open `.env` (in the repo root: both the pipeline and the dashboard read this one file) and fill in
`DATABASE_URL`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Then:

```bash
npm run db:migrate
```

You should see `applied 20261008000000_init.sql` and `applied 20261008000100_skills.sql`.
Running it again prints `database is up to date`. (Using the Supabase CLI instead?
`supabase link` then `supabase db push` applies the same files.)

## 3. Run the dashboard and fill in your profile

```bash
npm run dev
```

Open <http://localhost:5173>, sign in with Google or an email link, and go to **Settings**.
Fill in at least:

- **Skills.** These drive matching. Type freely: "node" and "springboot" are understood as
  Node.js and Spring Boot.
- **Target job titles,** e.g. "backend developer". Without saved searches, Jooble searches these.
- **Cities** and **Visa status.** On a visit visa, "UAE residents only" jobs are filtered out.
- **Years of experience.** Jobs asking for more than yours + 2 are filtered out.

Save, then run the pipeline once by hand:


```bash
npm run pipeline -- run
```

With no sources configured yet, it prints `collector skipped (not configured)` for each one.
That's expected. The next steps add sources.

## 4. Gmail job alerts (Indeed, LinkedIn, Bayt, Naukrigulf)

Callback reads the job-alert emails these sites already send you.

**4a. Create alerts on the sites.** Make several, one per title × site:
"Node.js developer", "backend developer", "Java developer", "full stack developer"… in Dubai or
the UAE, on Indeed, LinkedIn, Bayt and Naukrigulf. Choose daily (or instant) emails. About 20
alerts gives you 100+ jobs a day.

**4b. Create a Google OAuth client for Gmail.**

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project (or reuse one).
2. APIs & Services → Library → enable the **Gmail API**.
3. APIs & Services → OAuth consent screen: choose **External**, fill in the app name and your
   email, and add yourself as a test user.
4. Credentials → Create credentials → OAuth client ID → type **Desktop app**. Copy the client
   id and secret into `.env` as `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET`.

> **Refresh tokens and "Testing" mode.** While the consent screen is in *Testing*, Google
> expires refresh tokens after 7 days, and the pipeline then stops reading email. For long-term
> personal use, click **Publish app** on the consent screen. The app stays unverified (you'll
> see a warning when you sign in, which is fine for your own account) and the token stops
> expiring.

**4c. Get the refresh token.**

```bash
npm run gmail:auth            # read alerts only
npm run gmail:auth -- --send  # also allow the morning digest by email
```

Open the printed link, sign in with the Gmail account that receives the alerts, and copy the
printed `GMAIL_REFRESH_TOKEN=...` line into `.env`.

**4d. Check the parser.** Once some alert emails have arrived:

```bash
npm run gmail:sample
```

This shows the jobs found in your five newest alert emails and saves those emails to
`pipeline/test/fixtures/private/` (git-ignored). If an email shows no jobs, see
[Pipeline → Tuning the email parsers](04-pipeline.md#tuning-the-email-parsers).

## 5. Jooble API

1. Request a free key at <https://jooble.org/api/about>.
2. Put it in `.env` as `JOOBLE_API_KEY`.
3. Optional: add keyword searches in Settings → Jooble searches. Without any, Callback searches
   your target job titles across the UAE.

If results are not UAE-focused, check whether your key's welcome email names a country-specific
API address, and set `JOOBLE_HOST` to that host.

## 6. Free AI keys

- **Gemini** (main): create a key at <https://aistudio.google.com/apikey> → `GEMINI_API_KEY`.
- **Groq** (fallback): create a key at <https://console.groq.com/keys> → `GROQ_API_KEY`.

Defaults use `gemini-3.5-flash-lite` for scoring and `gemini-3.8-flash` for drafts, both on the
free tier as of October 2026. Google changes model names often: if you get a 404 for a model,
pick a current Flash model from <https://ai.google.dev/gemini-api/docs/models> and set
`GEMINI_SCORE_MODEL` / `GEMINI_DRAFT_MODEL`.

On the free tier Google may use your prompts to improve its models, and your CV text is part
of the prompt. See [Security and privacy](08-security-and-privacy.md).

## 7. Telegram digest (optional)

1. In Telegram, message **@BotFather**, send `/newbot` and follow the steps. Copy the token into
   `.env` as `TELEGRAM_BOT_TOKEN`.
2. Send any message to your new bot, so it is allowed to message you back.
3. Message **@userinfobot** to get your numeric chat id.
4. In Settings → Morning digest, choose Telegram and paste the chat id.

For email instead, choose Email in Settings and make sure you ran `npm run gmail:auth -- --send`.

## 8. Schedule the pipeline and deploy the dashboard

**Lock down sign-ups first.** Once the dashboard is online, anyone with the link could create an
account, and the pipeline would spend your AI quota on them. After signing in yourself:

1. Supabase → Authentication → Sign In / Providers: turn off **Allow new users to sign up**.
2. Copy your user id (Authentication → Users) into the `ALLOWED_USER_IDS` GitHub variable below,
   so the pipeline only ever runs for you.

**Commit the lockfile.** Your first `npm install` created `package-lock.json`. Commit it, so
GitHub installs exactly the same versions.

**Push the code to GitHub** (a private repository is fine).

**Add secrets.** GitHub repo → Settings → Secrets and variables → Actions:

| Name | Type | Value |
| --- | --- | --- |
| `DATABASE_URL` | Secret | Supabase session pooler URI |
| `GEMINI_API_KEY`, `GROQ_API_KEY` | Secret | Your AI keys |
| `JOOBLE_API_KEY` | Secret | Jooble key |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` | Secret | Gmail OAuth |
| `TELEGRAM_BOT_TOKEN` | Secret | Telegram bot token |
| `APP_URL` | Variable | Your dashboard URL (for links in the digest) |
| `ALLOWED_USER_IDS` | Variable | Your Supabase user id (comma-separate several) |

The **Daily pipeline** workflow (`.github/workflows/daily.yml`) then runs at 06:47 Dubai time.
To run it now: Actions → Daily pipeline → Run workflow. To run only some steps, type them in
the box, e.g. `match,score,draft`.

**Deploy the dashboard on Vercel.**

1. Import the repository at [vercel.com/new](https://vercel.com/new).
2. Set **Root Directory** to `web`. Vercel detects Vite.
3. Add the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy, then put the Vercel URL in Supabase (Authentication → URL Configuration: Site URL and
   Redirect URLs) and in the `APP_URL` GitHub variable.

Done. Every morning: new jobs land, the best ones get scored and drafted, and the digest
arrives. Your part is about 20 minutes on the Today page.

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| `Invalid configuration: DATABASE_URL` | `.env` missing or not in the repo root |
| `getaddrinfo ENOTFOUND` / timeouts to the database from GitHub | Use the Session pooler URI, not the direct connection |
| Gmail collector fails with `invalid_grant` | Refresh token expired (Testing mode) or revoked: publish the consent screen and rerun `npm run gmail:auth` |
| Gmail runs but finds 0 jobs | Run `npm run gmail:sample`; tune the parser (docs/04-pipeline.md) |
| AI calls fail with 404 | Model name retired: set `GEMINI_SCORE_MODEL` / `GEMINI_DRAFT_MODEL` |
| AI calls fail with 429 | Free daily limit reached: Callback switches to Groq, then heuristic scores. Lower "AI-scored jobs per day" in Settings |
| Dashboard shows "Supabase isn't connected yet" | `VITE_SUPABASE_*` missing; restart `npm run dev` after editing `.env` |
| Sign-in link opens the wrong site | Site URL / Redirect URLs in Supabase Authentication settings |
| Today is empty after a run | Profile missing or rules too strict: in Jobs, tick "Include jobs your rules filtered out" to see the reasons |
