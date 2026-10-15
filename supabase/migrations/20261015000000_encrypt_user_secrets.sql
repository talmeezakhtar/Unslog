-- Encrypt user_secrets at rest. Previously gmail_refresh_token, jooble_api_key, gemini_api_key
-- and groq_api_key were plain text columns: isolated between users by RLS, but readable in the
-- clear by anything with a database connection (a DB dump, a leaked DATABASE_URL, or a future
-- query that happens to select them). They're now pgp_sym_encrypt'd bytea columns, decryptable
-- only inside functions that hold the key — never by a client query.
--
-- The key lives in app_secrets, a table with RLS enabled and no policies at all, same trick
-- already used for ai_usage/raw_listings: anon and authenticated get zero rows through the API,
-- while a direct Postgres connection (the pipeline's DATABASE_URL, same role that owns these
-- tables) and the SECURITY DEFINER functions below can still read it. Generated once, randomly,
-- per database, so there's no default to forget to rotate.

create table app_secrets (
  key   text primary key,
  value text not null
);
alter table app_secrets enable row level security;
insert into app_secrets (key, value) values ('user_secrets_key', encode(gen_random_bytes(32), 'hex'));

alter table user_secrets
  add column gmail_refresh_token_enc bytea,
  add column jooble_api_key_enc      bytea,
  add column gemini_api_key_enc      bytea,
  add column groq_api_key_enc        bytea;

update user_secrets set
  gmail_refresh_token_enc = case when gmail_refresh_token is not null then
    pgp_sym_encrypt(gmail_refresh_token, (select value from app_secrets where key = 'user_secrets_key')) end,
  jooble_api_key_enc = case when jooble_api_key is not null then
    pgp_sym_encrypt(jooble_api_key, (select value from app_secrets where key = 'user_secrets_key')) end,
  gemini_api_key_enc = case when gemini_api_key is not null then
    pgp_sym_encrypt(gemini_api_key, (select value from app_secrets where key = 'user_secrets_key')) end,
  groq_api_key_enc = case when groq_api_key is not null then
    pgp_sym_encrypt(groq_api_key, (select value from app_secrets where key = 'user_secrets_key')) end;

alter table user_secrets
  drop column gmail_refresh_token,
  drop column jooble_api_key,
  drop column gemini_api_key,
  drop column groq_api_key;
alter table user_secrets rename column gmail_refresh_token_enc to gmail_refresh_token;
alter table user_secrets rename column jooble_api_key_enc      to jooble_api_key;
alter table user_secrets rename column gemini_api_key_enc      to gemini_api_key;
alter table user_secrets rename column groq_api_key_enc        to groq_api_key;

-- The old "own secrets" policy let the client select/insert/update the raw columns directly —
-- harmless now that they're ciphertext, but there's no reason to expose even that. Drop it with
-- no replacement: RLS stays enabled, so authenticated gets zero rows, same as ai_usage/raw_listings.
-- All reads and writes go through the functions below instead.
drop policy "own secrets" on user_secrets;

-- Captured once, right after Google OAuth, same as before — just encrypts before storing.
-- Never paired with a getter: the dashboard must not be able to read this back.
create or replace function set_gmail_refresh_token(token text) returns void
language sql security definer set search_path = public as $$
  insert into user_secrets (user_id, gmail_refresh_token)
  values (auth.uid(), pgp_sym_encrypt(token, (select value from app_secrets where key = 'user_secrets_key')))
  on conflict (user_id) do update set gmail_refresh_token = excluded.gmail_refresh_token;
$$;

-- BYOK keys are fine to round-trip to their own owner for editing (unchanged from before);
-- they're just encrypted in storage now instead of sitting there in the clear.
create or replace function get_byok_secrets()
returns table (jooble_api_key text, gemini_api_key text, groq_api_key text)
language sql security definer set search_path = public as $$
  select
    case when jooble_api_key is null then null else pgp_sym_decrypt(jooble_api_key, (select value from app_secrets where key = 'user_secrets_key')) end,
    case when gemini_api_key is null then null else pgp_sym_decrypt(gemini_api_key, (select value from app_secrets where key = 'user_secrets_key')) end,
    case when groq_api_key   is null then null else pgp_sym_decrypt(groq_api_key,   (select value from app_secrets where key = 'user_secrets_key')) end
  from user_secrets where user_id = auth.uid();
$$;

create or replace function set_byok_secrets(jooble text, gemini text, groq text) returns void
language sql security definer set search_path = public as $$
  insert into user_secrets (user_id, jooble_api_key, gemini_api_key, groq_api_key)
  values (
    auth.uid(),
    case when jooble is null or jooble = '' then null else pgp_sym_encrypt(jooble, (select value from app_secrets where key = 'user_secrets_key')) end,
    case when gemini is null or gemini = '' then null else pgp_sym_encrypt(gemini, (select value from app_secrets where key = 'user_secrets_key')) end,
    case when groq   is null or groq   = '' then null else pgp_sym_encrypt(groq,   (select value from app_secrets where key = 'user_secrets_key')) end
  )
  on conflict (user_id) do update set
    jooble_api_key = excluded.jooble_api_key, gemini_api_key = excluded.gemini_api_key, groq_api_key = excluded.groq_api_key;
$$;

revoke execute on function set_gmail_refresh_token(text), get_byok_secrets(), set_byok_secrets(text, text, text)
  from public, anon;
grant execute on function set_gmail_refresh_token(text), get_byok_secrets(), set_byok_secrets(text, text, text)
  to authenticated;
