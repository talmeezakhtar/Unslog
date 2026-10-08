import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The browser talks to Supabase with the public "anon" key. That is safe: every table has
 * Row Level Security, so a signed-in user can only read shared job data and their own rows.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anonKey);
export const supabase: SupabaseClient = createClient(url ?? 'http://localhost:54321', anonKey ?? 'missing-anon-key');
