/**
 * BhoomiSetu — Custom SQL Migration Runner
 * Reads numbered .sql files from db/migrations/ and applies them in order.
 * Tracks applied migrations in the _migrations table.
 *
 * Usage: npx tsx scripts/migrate.ts
 */

import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf-8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const root = path.resolve(__dirname, '..');
loadEnvFile(path.join(root, '.env.local'));
loadEnvFile(path.join(root, '.env'));

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required.');
  console.error('   Set it in .env.local or export it before running migrations.');  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function ensureMigrationsTable(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL PRIMARY KEY,
      filename    TEXT UNIQUE NOT NULL,
      applied_at  TIMESTAMPTZ DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(client: PoolClient): Promise<Set<string>> {
  const result = await client.query('SELECT filename FROM _migrations ORDER BY id');
  return new Set(result.rows.map((row: { filename: string }) => row.filename));
}


async function run() {
  const client = await pool.connect();

  try {
    console.log('🏗️  BhoomiSetu Migration Runner');
    console.log('================================\n');

    // Ensure the _migrations tracking table exists
    await ensureMigrationsTable(client);

    // Get list of already-applied migrations
    const applied = await getAppliedMigrations(client);
    console.log(`📋 Already applied: ${applied.size} migration(s)\n`);

    // Read migration files from db/migrations/
    const migrationsDir = path.join(root, 'db', 'migrations');

    if (!fs.existsSync(migrationsDir)) {
      console.error(`❌ Migrations directory not found: ${migrationsDir}`);
      process.exit(1);
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Numeric sort by filename prefix (0001, 0002, etc.)

    if (files.length === 0) {
      console.log('ℹ️  No migration files found.');
      return;
    }

    let appliedCount = 0;
    let skippedCount = 0;

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`⏭️  Skipping (already applied): ${file}`);
        skippedCount++;
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`▶️  Applying: ${file}...`);

      try {
        // Run the migration in a transaction
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO _migrations (filename) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');

        console.log(`   ✅ Applied successfully: ${file}`);
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`   ❌ Failed to apply: ${file}`);
        console.error(`   Error: ${(err as Error).message}`);
        process.exit(1);
      }
    }

    console.log(`\n================================`);
    console.log(`✅ Done. Applied: ${appliedCount}, Skipped: ${skippedCount}, Total: ${files.length}`);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('💥 Migration runner failed:', err);
  process.exit(1);
});
