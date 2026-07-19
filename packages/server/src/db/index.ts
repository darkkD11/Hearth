import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.db.connectionString,
  max: 10,             // More than enough for 6-8 users
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Log connection events in development
pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err);
  process.exit(-1);
});

/**
 * Convenience wrapper for parameterized queries.
 * Usage: const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
 */
export const db = {
  query: <T extends pg.QueryResultRow = any>(
    text: string,
    params?: any[]
  ) => pool.query<T>(text, params),

  /** Get a client from the pool for transactions */
  getClient: () => pool.connect(),
};
