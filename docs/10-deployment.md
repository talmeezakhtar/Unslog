# Deployment

Three free services, no servers:

| Piece | Service | Cost |
| --- | --- | --- |
| Database + auth | Supabase free plan | Free (the project pauses after a week of no activity; the daily run keeps it active) |
| Daily pipeline + CI | GitHub Actions | Free for public repos; private repos include free minutes each month (one run takes a few minutes) |
| Dashboard | Vercel Hobby | Free for personal, non-commercial use |

Step-by-step setup is in [Getting started](01-getting-started.md#8-schedule-the-pipeline-and-deploy-the-dashboard).
This page covers running it day to day.

## The daily run

- Schedule: `0 4 * * *` UTC (08:00 Dubai) in `.github/workflows/daily.yml`. GitHub can start
  scheduled jobs a few minutes late, and pauses schedules on repositories with no activity for
  60 days. Push anything (or re-enable the workflow) to resume.
- Manual run: Actions → Daily pipeline → Run workflow (optionally with steps).
- `concurrency` makes sure two runs never overlap.
- If every collector fails, the job fails and GitHub emails you.

## Database changes

1. Add a new file in `supabase/migrations/` named with a later timestamp. Never edit applied files.
2. `npm run db:migrate` locally against your Supabase `DATABASE_URL` (or `supabase db push`).
3. Each migration runs as one transaction, so a failure applies nothing.

## Dashboard releases

Vercel deploys every push to `main` and gives each pull request a preview URL. `web/vercel.json`
rewrites every path to `index.html`, so deep links like `/jobs/123` work.

## Backups

The Supabase free plan has no point-in-time recovery. For a personal backup:

```bash
pg_dump "$DATABASE_URL" --no-owner --format=custom --file=callback-$(date +%F).dump
```

## Monitoring checklist

- Today → Sources: every source green.
- Sidebar: AI calls today well under your limits.
- Actions tab: daily runs green.
- `collector_runs` with `status = 'failed'`: the `error` column says why.
