-- Unslog: initial schema
--
-- Two kinds of tables:
--   * Shared job data (sources, companies, jobs, sightings, skills). Written only by the
--     pipeline (service role), readable by every signed-in user.
--   * Per-user data (profile, matches, drafts, applications, outreach...). Every row has
--     user_id, and Row Level Security (RLS) limits each user to their own rows.
--
-- The pipeline connects with the database owner role, which bypasses RLS.
-- The web app connects with the anon key + the user's session, so RLS applies.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type source_kind as enum ('email', 'api', 'ats');
create type run_status as enum ('running', 'success', 'failed');
create type application_status as enum (
  'saved', 'applied', 'follow_up_due', 'interview', 'offer', 'rejected', 'withdrawn'
);
create type application_channel as enum ('portal', 'email', 'referral', 'outreach');
create type draft_type as enum ('cover_note', 'outreach', 'follow_up');
create type outreach_channel as enum ('linkedin', 'email', 'whatsapp', 'other');
create type outreach_status as enum ('sent', 'replied', 'no_reply');
create type interview_type as enum ('hr', 'technical', 'final', 'other');
create type interview_outcome as enum ('pending', 'passed', 'failed');
create type digest_channel as enum ('none', 'telegram', 'email');

-- ---------------------------------------------------------------------------
-- Shared job data
-- ---------------------------------------------------------------------------

-- A place jobs come from: one email alert site, one API, or one company's ATS board.
create table sources (
  id              uuid primary key default gen_random_uuid(),
  key             text not null unique,          -- e.g. 'gmail:indeed', 'jooble', 'ats:lever:acme'
  name            text not null,                 -- display name, e.g. 'Indeed (email alerts)'
  kind            source_kind not null,
  config          jsonb not null default '{}'::jsonb,
  enabled         boolean not null default true,
  last_success_at timestamptz,
  last_error      text,
  created_at      timestamptz not null default now()
);

-- One run of one collector. Used for debugging and the "Collectors" health card.
create table collector_runs (
  id          uuid primary key default gen_random_uuid(),
  collector   text not null,                     -- 'gmail', 'jooble', 'ats:greenhouse:acme'
  source_id   uuid references sources(id) on delete set null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  found       integer not null default 0,
  new_count   integer not null default 0,
  status      run_status not null default 'running',
  error       text,
  created_at  timestamptz not null default now()
);
create index collector_runs_started_idx on collector_runs (started_at desc);

create table companies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  normalized_name text not null unique,          -- lowercased, legal suffixes removed
  website         text,
  ats_type        text,
  ats_slug        text,
  created_at      timestamptz not null default now()
);

-- One real job opening, after deduplication across sites.
create table jobs (
  id                  uuid primary key default gen_random_uuid(),
  fingerprint         text not null unique,      -- sha1(company|title|city), see pipeline/src/stages/dedupe.ts
  company_id          uuid references companies(id) on delete set null,
  title               text not null,
  city                text,                      -- 'Dubai', 'Abu Dhabi', 'Sharjah', ... or null if unknown
  country             text not null default 'AE',
  description         text,                      -- full text when the source provides it, else a snippet
  description_is_full boolean not null default false,
  salary_text         text,
  salary_min_aed      integer,                   -- monthly, parsed from salary_text when possible
  salary_max_aed      integer,
  experience_min      integer,                   -- years, parsed from the description when possible
  visa_flags          text[] not null default '{}',  -- 'residents_only', 'visit_visa_ok', 'sponsorship'
  posted_at           timestamptz,
  first_seen_at       timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),
  is_open             boolean not null default true,
  created_at          timestamptz not null default now()
);
create index jobs_first_seen_idx on jobs (first_seen_at desc);
create index jobs_company_idx on jobs (company_id);

-- Where and when a job was seen. One job on three sites = one jobs row + three sightings.
create table job_sightings (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references jobs(id) on delete cascade,
  source_id     uuid not null references sources(id) on delete cascade,
  url           text not null,
  external_id   text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  unique (job_id, source_id)
);
create index job_sightings_source_idx on job_sightings (source_id);

-- Untouched data as fetched. Lets us fix a parser and re-process without fetching again.
create table raw_listings (
  id               uuid primary key default gen_random_uuid(),
  source_id        uuid not null references sources(id) on delete cascade,
  collector_run_id uuid references collector_runs(id) on delete set null,
  external_id      text not null,
  payload          jsonb not null,
  job_id           uuid references jobs(id) on delete set null,
  fetched_at       timestamptz not null default now(),
  unique (source_id, external_id)
);

create table skills (
  id       serial primary key,
  name     text not null unique,                 -- canonical name, e.g. 'Node.js'
  aliases  text[] not null default '{}',         -- lowercase alternatives, e.g. {'node','nodejs'}
  category text not null default 'other'
);

create table job_skills (
  job_id   uuid not null references jobs(id) on delete cascade,
  skill_id integer not null references skills(id) on delete cascade,
  primary key (job_id, skill_id)
);
create index job_skills_skill_idx on job_skills (skill_id);

-- AI calls per day, so we stay inside free-tier limits. Instance-wide (keys are instance-wide).
create table ai_usage (
  day        date not null default current_date,
  provider   text not null,
  model      text not null,
  purpose    text not null,                      -- 'score' | 'draft'
  requests   integer not null default 0,
  failures   integer not null default 0,
  tokens_in  integer not null default 0,
  tokens_out integer not null default 0,
  primary key (day, provider, model, purpose)
);

-- ---------------------------------------------------------------------------
-- Per-user data
-- ---------------------------------------------------------------------------

-- What the pipeline matches jobs against. One row per user (auth.users is the User entity).
create table profiles (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  full_name            text,
  headline             text,                     -- one line about you, used in drafts
  skills               text[] not null default '{}',
  years_experience     integer not null default 0,
  target_titles        text[] not null default '{}',
  cities               text[] not null default '{Dubai,Abu Dhabi,Sharjah}',
  visa_status          text not null default 'visit' check (visa_status in ('visit', 'resident', 'needs_sponsorship')),
  cv_text              text,
  highlight_project    text,                     -- one project drafts may mention
  must_have            text[] not null default '{}',
  blocked_words        text[] not null default '{}',
  min_score            integer not null default 60 check (min_score between 0 and 100),
  max_ai_jobs_per_day  integer not null default 30 check (max_ai_jobs_per_day between 0 and 500),
  follow_up_days       integer not null default 6 check (follow_up_days between 1 and 60),
  target_companies     jsonb not null default '[]'::jsonb,  -- [{ "ats": "lever", "slug": "acme", "name": "Acme" }]
  digest_channel       digest_channel not null default 'none',
  digest_email         text check (digest_email is null or digest_email = '' or digest_email ~ '^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$'),
  telegram_chat_id     text check (telegram_chat_id is null or telegram_chat_id = '' or telegram_chat_id ~ '^-?[0-9]{1,20}$'),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- A job-alert search the user set up (email alerts on a site) or wants queried (API).
create table saved_searches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  keywords   text not null,
  location   text not null default 'United Arab Emirates',
  site       text not null default 'jooble',     -- 'jooble' (queried by us) or an alert site name (reference only)
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);
create index saved_searches_user_idx on saved_searches (user_id);

-- How well one job fits one user. Per user, not on jobs, because the same job scores differently for different people.
create table job_matches (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  job_id           uuid not null references jobs(id) on delete cascade,
  prefilter_passed boolean not null,
  prefilter_reason text,
  quick_score      integer,                      -- free heuristic score, used to pick which jobs get AI
  score            integer check (score between 0 and 100),
  reasons          jsonb not null default '[]'::jsonb,
  missing_skills   text[] not null default '{}',
  visa_note        text,
  model            text,                         -- 'heuristic' when no AI was used
  scored_at        timestamptz,
  dismissed_at     timestamptz,
  created_at       timestamptz not null default now(),
  unique (user_id, job_id)
);
create index job_matches_user_score_idx on job_matches (user_id, score desc nulls last);
create index job_matches_user_created_idx on job_matches (user_id, created_at desc);

create table contacts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  company_id   uuid references companies(id) on delete set null,
  name         text not null,
  role         text,
  linkedin_url text,
  email        text,
  how_found    text,
  notes        text,
  created_at   timestamptz not null default now()
);
create index contacts_user_idx on contacts (user_id);

create table drafts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  job_id         uuid not null references jobs(id) on delete cascade,
  contact_id     uuid references contacts(id) on delete set null,
  type           draft_type not null,
  content        text not null,
  model          text,
  edited_by_user boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, job_id, type)
);

create table applications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  job_id            uuid not null references jobs(id) on delete cascade,
  status            application_status not null default 'saved',
  channel           application_channel,
  applied_at        timestamptz,
  next_follow_up_at timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, job_id)
);
create index applications_followup_idx on applications (user_id, status, next_follow_up_at);

-- Append-only history of status changes. Written by a trigger, never by hand.
create table application_events (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  from_status    application_status,
  to_status      application_status not null,
  at             timestamptz not null default now(),
  note           text
);
create index application_events_app_idx on application_events (application_id, at);

create table interviews (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references applications(id) on delete cascade,
  round          integer not null default 1,
  type           interview_type not null default 'other',
  scheduled_at   timestamptz,
  outcome        interview_outcome not null default 'pending',
  notes          text,
  created_at     timestamptz not null default now()
);

create table outreach (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  job_id     uuid references jobs(id) on delete set null,
  draft_id   uuid references drafts(id) on delete set null,
  channel    outreach_channel not null default 'linkedin',
  message    text,
  status     outreach_status not null default 'sent',
  sent_at    timestamptz not null default now(),
  replied_at timestamptz,
  created_at timestamptz not null default now()
);
create index outreach_user_idx on outreach (user_id, sent_at desc);

create table digests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  sent_at      timestamptz not null default now(),
  channel      digest_channel not null,
  job_ids      uuid[] not null default '{}',
  followup_ids uuid[] not null default '{}',
  ok           boolean not null default true,
  error        text
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger drafts_updated_at before update on drafts
  for each row execute function set_updated_at();

-- When an application's status changes: stamp applied_at, schedule the follow-up,
-- and append an application_events row. Runs as the table owner so users can't forge events.
create or replace function applications_track_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  days integer;
begin
  new.updated_at := now();

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status = 'applied' then
      new.applied_at := coalesce(new.applied_at, now());
      select coalesce(p.follow_up_days, 6) into days from profiles p where p.user_id = new.user_id;
      -- Back to "applied" after a nudge (from follow_up_due): the next check-in counts from today,
      -- otherwise it would be due again immediately.
      new.next_follow_up_at :=
        (case when tg_op = 'UPDATE' and old.status = 'follow_up_due' then now() else new.applied_at end)
        + make_interval(days => coalesce(days, 6));
    elsif new.status in ('interview', 'offer', 'rejected', 'withdrawn') then
      new.next_follow_up_at := null;
    end if;
  end if;
  return new;
end $$;

create or replace function applications_log_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into application_events (application_id, user_id, from_status, to_status)
    values (new.id, new.user_id, null, new.status);
  elsif new.status is distinct from old.status then
    insert into application_events (application_id, user_id, from_status, to_status)
    values (new.id, new.user_id, old.status, new.status);
  end if;
  return null;
end $$;

create trigger applications_before before insert or update on applications
  for each row execute function applications_track_status();
create trigger applications_after after insert or update on applications
  for each row execute function applications_log_event();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table sources            enable row level security;
alter table collector_runs     enable row level security;
alter table companies          enable row level security;
alter table jobs               enable row level security;
alter table job_sightings      enable row level security;
alter table raw_listings       enable row level security;
alter table skills             enable row level security;
alter table job_skills         enable row level security;
alter table ai_usage           enable row level security;
alter table profiles           enable row level security;
alter table saved_searches     enable row level security;
alter table job_matches        enable row level security;
alter table contacts           enable row level security;
alter table drafts             enable row level security;
alter table applications       enable row level security;
alter table application_events enable row level security;
alter table interviews         enable row level security;
alter table outreach           enable row level security;
alter table digests            enable row level security;

-- Shared job data: read-only for signed-in users. raw_listings and ai_usage get no policy (service only).
create policy "read sources"        on sources        for select to authenticated using (true);
create policy "read collector runs" on collector_runs for select to authenticated using (true);
create policy "read companies"      on companies      for select to authenticated using (true);
create policy "read jobs"           on jobs           for select to authenticated using (true);
create policy "read sightings"      on job_sightings  for select to authenticated using (true);
create policy "read skills"         on skills         for select to authenticated using (true);
create policy "read job skills"     on job_skills     for select to authenticated using (true);

-- Per-user data: own rows only.
create policy "own profile" on profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own saved searches" on saved_searches for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "read own matches" on job_matches for select to authenticated
  using (user_id = auth.uid());
create policy "update own matches" on job_matches for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own contacts" on contacts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own drafts" on drafts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own applications" on applications for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "read own events" on application_events for select to authenticated
  using (user_id = auth.uid());
create policy "own interviews" on interviews for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own outreach" on outreach for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "read own digests" on digests for select to authenticated
  using (user_id = auth.uid());

-- Users may only change dismissed_at on their matches, not the scores the pipeline wrote.
revoke update on job_matches from authenticated;
grant update (dismissed_at) on job_matches to authenticated;

-- ---------------------------------------------------------------------------
-- Read functions for the dashboard (run as the caller, so RLS still applies,
-- except ai_usage_today which only returns aggregate counts).
-- ---------------------------------------------------------------------------

-- Numbers for the "Today" page.
create or replace function today_summary() returns json
language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'new_jobs_today',  (select count(*) from jobs where first_seen_at >= date_trunc('day', now())),
    'matches_today',   (select count(*) from job_matches where user_id = auth.uid() and created_at >= date_trunc('day', now())),
    'passed_today',    (select count(*) from job_matches where user_id = auth.uid() and prefilter_passed and created_at >= date_trunc('day', now())),
    'ai_scored_today', (select count(*) from job_matches where user_id = auth.uid() and model is not null and model <> 'heuristic' and scored_at >= date_trunc('day', now())),
    'followups_due',   (select count(*) from applications where user_id = auth.uid()
                          and (status = 'follow_up_due' or (status = 'applied' and next_follow_up_at <= now()))),
    'interviews_week', (select count(*) from interviews where user_id = auth.uid()
                          and scheduled_at between now() and now() + interval '7 days'),
    'last_run_at',     (select max(finished_at) from collector_runs where status = 'success')
  );
$$;

create or replace function ai_usage_today() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('provider', provider, 'purpose', purpose, 'requests', requests)), '[]'::json)
  from ai_usage where day = current_date;
$$;

create or replace function insights_top_skills(days integer default 30, lim integer default 15)
returns table (skill text, jobs bigint, share numeric)
language sql stable security invoker set search_path = public as $$
  with recent as (select id from jobs where first_seen_at >= now() - make_interval(days => days)),
       total as (select greatest(count(*), 1) as n from recent)
  select s.name, count(*), round(100.0 * count(*) / (select n from total), 1)
  from job_skills js join recent r on r.id = js.job_id join skills s on s.id = js.skill_id
  group by s.name order by count(*) desc limit lim;
$$;

create or replace function insights_top_companies(days integer default 30, lim integer default 10)
returns table (company text, jobs bigint)
language sql stable security invoker set search_path = public as $$
  select c.name, count(*)
  from jobs j join companies c on c.id = j.company_id
  where j.first_seen_at >= now() - make_interval(days => days)
  group by c.name order by count(*) desc limit lim;
$$;

create or replace function insights_jobs_per_week(weeks integer default 12)
returns table (week date, jobs bigint)
language sql stable security invoker set search_path = public as $$
  select date_trunc('week', first_seen_at)::date, count(*)
  from jobs where first_seen_at >= now() - make_interval(weeks => weeks)
  group by 1 order by 1;
$$;

create or replace function insights_salary_by_title(days integer default 90, lim integer default 8)
returns table (title text, jobs bigint, low integer, high integer)
language sql stable security invoker set search_path = public as $$
  select lower(title), count(*), min(salary_min_aed), max(coalesce(salary_max_aed, salary_min_aed))
  from jobs
  where salary_min_aed is not null and first_seen_at >= now() - make_interval(days => days)
  group by lower(title) order by count(*) desc limit lim;
$$;

create or replace function insights_funnel()
returns table (stage text, n bigint)
language sql stable security invoker set search_path = public as $$
  with apps as (select * from applications where user_id = auth.uid()),
       ev as (select distinct application_id, to_status from application_events where user_id = auth.uid())
  select 'Matched', (select count(*) from job_matches where user_id = auth.uid() and prefilter_passed)
  union all select 'Applied',   (select count(distinct application_id) from ev where to_status = 'applied')
  union all select 'Interview', (select count(distinct application_id) from ev where to_status = 'interview')
  union all select 'Offer',     (select count(distinct application_id) from ev where to_status = 'offer');
$$;

create or replace function insights_reply_by_channel()
returns table (channel text, sent bigint, replied bigint)
language sql stable security invoker set search_path = public as $$
  select channel::text, count(*), count(*) filter (where status = 'replied')
  from outreach where user_id = auth.uid() group by channel order by 2 desc;
$$;

-- Functions are executable by everyone (PUBLIC, including anon) by default; limit them to signed-in users.
revoke execute on all functions in schema public from public, anon;
grant execute on function today_summary(), ai_usage_today(), insights_top_skills(integer, integer),
  insights_top_companies(integer, integer), insights_jobs_per_week(integer),
  insights_salary_by_title(integer, integer), insights_funnel(), insights_reply_by_channel()
  to authenticated;
