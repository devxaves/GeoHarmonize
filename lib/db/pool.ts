/**
 * BhoomiSetu — PostgreSQL Connection Pool (Raw SQL, No ORM)
 *
 * Shared pg.Pool singleton using DATABASE_URL env var.
 * All query modules import from this file.
 *
 * Usage:
 *   import { query, getClient } from '@/lib/db/pool';
 *   const result = await query('SELECT * FROM projects WHERE id = $1', [id]);
 */

import { Pool, PoolClient, QueryResult, QueryResultRow, types } from 'pg';

// Parse PostgreSQL NUMERIC/DECIMAL (OID 1700) as floating point numbers instead of strings
types.setTypeParser(1700, (val: string) => (val === null ? null : parseFloat(val)));

// Singleton pool — reused across all API routes in the Node.js process
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL environment variable is not set. ' +
        'Please add it to .env.local with your Neon PostgreSQL connection string.'
      );
    }

    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,              // max connections in pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Log pool errors (don't crash the process)
    pool.on('error', (err) => {
      console.error('🔴 Unexpected PostgreSQL pool error:', err);
    });
  }

  return pool;
}

/**
 * Execute a parameterized SQL query against the pool.
 * This is the primary way all query modules should access the database.
 *
 * @example
 * const { rows } = await query<Project>('SELECT * FROM projects WHERE district = $1', ['Nashik']);
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: (string | number | boolean | null | object)[]
): Promise<QueryResult<T>> {
  const p = getPool();
  return p.query<T>(sql, params);
}

/**
 * Get a dedicated client from the pool for transactions.
 * MUST call client.release() when done.
 *
 * @example
 * const client = await getClient();
 * try {
 *   await client.query('BEGIN');
 *   await client.query('UPDATE ...', [...]);
 *   await client.query('INSERT ...', [...]);
 *   await client.query('COMMIT');
 * } catch (err) {
 *   await client.query('ROLLBACK');
 *   throw err;
 * } finally {
 *   client.release();
 * }
 */
export async function getClient(): Promise<PoolClient> {
  const p = getPool();
  return p.connect();
}

/**
 * Run a function inside a transaction. Handles BEGIN/COMMIT/ROLLBACK automatically.
 *
 * @example
 * const result = await withTransaction(async (client) => {
 *   await client.query('UPDATE projects SET current_stage = $1 WHERE id = $2', ['award', projectId]);
 *   await client.query('INSERT INTO audit_log ...', [...]);
 *   return { success: true };
 * });
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
