import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The browser talks to Supabase with the public "anon" key. That is safe: every table has
 * Row Level Security, so a signed-in user can only read shared job data and their own rows.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anonKey);
export const supabase: SupabaseClient = createClient(url || 'http://localhost:54321', anonKey || 'missing-anon-key');

/**
 * Requests Gmail read access in the same consent screen as sign-in (new users), or re-prompts an
 * already-signed-in user to grant it (Settings' "Connect Gmail"). access_type/prompt=consent is
 * required to get a refresh token back, not just an access token. App.tsx's onAuthStateChange
 * listener captures the token the moment this resolves — Supabase never stores it itself.
 */
export function signInWithGmail() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      scopes: 'https://www.googleapis.com/auth/gmail.readonly',
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
}
