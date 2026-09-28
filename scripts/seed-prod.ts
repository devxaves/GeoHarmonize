/**
 * BhoomiSetu — Production Seed Runner
 * Applies scripts/seed-prod.sql directly to the database.
 * Safe to re-run: uses ON CONFLICT DO NOTHING throughout.
 *
 * Usage: npx tsx scripts/seed-prod.ts
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required.');
  console.error('   Export it before running: export DATABASE_URL=postgresql://...');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();

  try {
    console.log('🌱  BhoomiSetu Production Seed Runner');
    console.log('======================================\n');

    const sqlPath = path.resolve(__dirname, 'seed-prod.sql');
    if (!fs.existsSync(sqlPath)) {
      console.error('❌ seed-prod.sql not found at:', sqlPath);
      process.exit(1);
    }

    const sql = fs.readFileSync(sqlPath, 'utf-8');
    console.log(`📄 Loaded seed file: ${sqlPath}`);
    console.log(`   Size: ${(sql.length / 1024).toFixed(1)} KB\n`);

    console.log('▶️  Running seed inside a transaction...');
    await client.query('BEGIN');

    try {
      await client.query(sql);
      await client.query('COMMIT');
      console.log('\n✅ Seed applied successfully!\n');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    // Print summary counts
    const tables = [
      'users', 'projects', 'parcels', 'owners', 'notifications',
      'awards', 'compensation_payments', 'mutations', 'affected_families',
      'documents', 'risk_scores', 'grievances', 'audit_log', 'mock_adapter_log'
    ];

    console.log('📊 Table row counts after seed:');
    console.log('-------------------------------');
    for (const table of tables) {
      const res = await client.query(`SELECT COUNT(*) FROM ${table}`);
      const count = res.rows[0].count;
      console.log(`   ${table.padEnd(25)} ${count.padStart(4)} rows`);
    }
    console.log('');

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('\n💥 Seed runner failed:', err.message);
  console.error(err.detail ?? '');
  process.exit(1);
});
