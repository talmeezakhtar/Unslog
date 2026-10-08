import { loadEnv } from '../lib/env.js';

/** Reads env vars for helper scripts that don't need the full config. */
export function loadConfigLoose() {
  loadEnv();
  const v = (k: string) => {
    const x = process.env[k]?.trim();
    return x ? x : undefined;
  };
  return {
    GMAIL_CLIENT_ID: v('GMAIL_CLIENT_ID'),
    GMAIL_CLIENT_SECRET: v('GMAIL_CLIENT_SECRET'),
    GMAIL_REFRESH_TOKEN: v('GMAIL_REFRESH_TOKEN'),
    DATABASE_URL: v('DATABASE_URL'),
  };
}
