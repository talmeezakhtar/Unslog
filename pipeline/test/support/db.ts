import { connect, type Db } from '../../src/db/client.js';
import { migrate } from '../../src/scripts/migrate.js';

/** Database tests run only when TEST_DATABASE_URL points at a disposable Postgres database. */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

/** Wipes the test database and applies every migration from scratch. */
export async function freshDatabase(): Promise<Db> {
  if (!TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set');
  if (!/test/i.test(TEST_DATABASE_URL)) throw new Error('Refusing to wipe a database whose URL does not contain "test"');
  const db = connect(TEST_DATABASE_URL);
  await db.query(`drop schema if exists public cascade; drop schema if exists auth cascade; create schema public;`);
  await migrate(db, { withAuthStub: true, quiet: true });
  return db;
}

export async function createUser(db: Db, email: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email]);
  return rows[0]!.id;
}
