/**
 * Applies the SQL files in supabase/migrations in order, once each.
 *
 *   npm run db:migrate                      against DATABASE_URL (your Supabase project)
 *   npm run db:migrate -- --with-auth-stub  plain local Postgres: first creates the small
 *                                           pieces Supabase normally provides (auth schema, roles)
 *
 * With the Supabase CLI you can use `supabase db push` instead; both read the same files.
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, type Db } from '../db/client.js';
import { loadConfigLoose } from './loose-config.js';

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(here, '../../../supabase/migrations');
export const AUTH_STUB = join(here, '../../test/support/supabase-stub.sql');

export async function migrate(db: Db, opts: { withAuthStub?: boolean; quiet?: boolean } = {}): Promise<string[]> {
  if (opts.withAuthStub) await db.query(await readFile(AUTH_STUB, 'utf8'));
  await db.query(`create table if not exists _callback_migrations (name text primary key, applied_at timestamptz not null default now())`);
  // Supabase exposes public tables through its API; RLS with no policies keeps this one private.
  await db.query(`alter table _callback_migrations enable row level security`);
  const done = new Set((await db.query<{ name: string }>(`select name from _callback_migrations`)).rows.map((r) => r.name));
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    if (!/^[\w.-]+\.sql$/.test(file)) throw new Error(`Unexpected migration file name: ${file}`);
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    // Sent as ONE query: Postgres runs a multi-statement query as a single transaction, so a
    // failing migration leaves nothing half-applied (and no pooled connection stuck in a transaction).
    try {
      await db.query(`${sql}\n;\ninsert into _callback_migrations (name) values ('${file}');`);
      applied.push(file);
      if (!opts.quiet) console.log(`applied ${file}`);
    } catch (err) {
      throw new Error(`${file}: ${err instanceof Error ? err.message : err}`);
    }
  }
  if (!opts.quiet && applied.length === 0) console.log('database is up to date');
  return applied;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const url = loadConfigLoose().DATABASE_URL;
  if (!url) {
    console.error('Set DATABASE_URL first.');
    process.exit(1);
  }
  const db = connect(url);
  migrate(db, { withAuthStub: process.argv.includes('--with-auth-stub') })
    .then(() => db.close())
    .catch(async (err) => {
      console.error(err instanceof Error ? err.message : err);
      await db.close();
      process.exit(1);
    });
}
