import pg from 'pg';

/**
 * The pipeline talks to Postgres directly with SQL (no ORM), using the connection string from
 * Supabase. That role owns the tables, so Row Level Security does not apply here; the web app
 * is the side that RLS protects.
 */
export interface Db {
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params?: unknown[]): Promise<pg.QueryResult<T>>;
  close(): Promise<void>;
  /** Runs fn against one checked-out connection inside BEGIN/COMMIT, rolling back on error. */
  transaction<T>(fn: (db: Db) => Promise<T>): Promise<T>;
}

export function connect(databaseUrl: string): Db {
  const local = /localhost|127\.0\.0\.1/.test(databaseUrl);
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 4,
    // Supabase requires TLS. If the URL sets sslmode (e.g. verify-full with Supabase's CA
    // certificate, see docs/08-security-and-privacy.md), pg follows it. Otherwise the connection
    // is encrypted but the certificate is not verified. Local Postgres usually has no TLS.
    ssl: local || /sslmode=/.test(databaseUrl) ? undefined : { rejectUnauthorized: false },
  });
  const db: Db = {
    query: (sql, params) => pool.query(sql, params as unknown[]),
    close: () => pool.end(),
    async transaction(fn) {
      const client = await pool.connect();
      const txDb: Db = { query: (sql, params) => client.query(sql, params as unknown[]), close: db.close, transaction: db.transaction };
      try {
        await client.query('begin');
        const result = await fn(txDb);
        await client.query('commit');
        return result;
      } catch (err) {
        await client.query('rollback');
        throw err;
      } finally {
        client.release();
      }
    },
  };
  return db;
}
