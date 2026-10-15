-- Google keeps the OAuth consent screen in "Testing" status capped at 100 test users, added by
-- email in Cloud Console, so Gmail access stays free instead of needing Google's paid security
-- review. The admin has no way to see who hits that "access blocked" screen — it happens on
-- Google's own domain, before any redirect back to this app. So users ask here instead: this is
-- just a mailbox the admin checks (Supabase Table Editor), not an approval system the app enforces.
create table gmail_access_requests (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  requested_at timestamptz not null default now()
);
alter table gmail_access_requests enable row level security;
create policy "own gmail access request" on gmail_access_requests for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
