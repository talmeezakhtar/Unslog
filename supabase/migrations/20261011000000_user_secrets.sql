-- Per-user credentials for the multi-tenant flow: a connected Gmail account (via OAuth at
-- sign-in) plus optional bring-your-own-key integrations (Jooble, Gemini, Groq). Kept separate
-- from `profiles` deliberately: profiles loads on nearly every page, and these values should
-- never ride along in that payload. The web app writes gmail_refresh_token once, right after
-- OAuth completes, and never reads it back into a form; Jooble/Gemini/Groq keys are fine to
-- round-trip for editing.
create table user_secrets (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  gmail_refresh_token text,
  jooble_api_key      text,
  gemini_api_key      text,
  groq_api_key        text,
  updated_at          timestamptz not null default now()
);

create trigger user_secrets_updated_at before update on user_secrets
  for each row execute function set_updated_at();

alter table user_secrets enable row level security;

create policy "own secrets" on user_secrets for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Cheap, safe-to-display status flag so the dashboard can show "Gmail connected" without ever
-- touching user_secrets.
alter table profiles add column gmail_connected boolean not null default false;

-- Per-user dimension on sightings: a job found through one person's personal Gmail alerts is
-- only a sighting for that person, not a global fact about the job the way a Jooble/ATS sighting
-- is. Shared sources keep user_id null; Gmail sightings carry the finding user's id, so two
-- users' sightings of the same job (via their own inboxes) stay distinct rows instead of
-- colliding on (job_id, source_id).
-- Plain `unique (job_id, source_id, user_id)` would not actually dedupe global sightings:
-- Postgres never treats two NULLs as equal, so every Jooble/ATS sighting (user_id always null)
-- would count as distinct and the old duplicate-prevention would silently stop working. Coalesce
-- null to a fixed sentinel inside the index so all-null rows still collide with each other, while
-- real user ids stay naturally distinct.
alter table job_sightings add column user_id uuid references auth.users(id) on delete cascade;
alter table job_sightings drop constraint job_sightings_job_id_source_id_key;
create unique index job_sightings_job_id_source_id_user_id_key on job_sightings (
  job_id, source_id, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
