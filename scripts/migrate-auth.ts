/**
 * BhoomiSetu — Run Migration 0004
 * Run: npx tsx scripts/migrate-auth.ts
 */

import { query } from "../lib/db/pool";
import bcrypt from "bcryptjs";

async function migrate() {
  console.log("Running migration 0004: DB-based auth...\n");

  // 1. Add password_hash column
  try {
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
    console.log("✓ Added password_hash column");
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      console.log("✓ password_hash column already exists");
    } else {
      throw e;
    }
  }

  // 2. Add name column
  try {
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT`);
    console.log("✓ Added name column");
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      console.log("✓ name column already exists");
    } else {
      throw e;
    }
  }

  // 3. Make clerk_id nullable
  try {
    await query(`ALTER TABLE users ALTER COLUMN clerk_id DROP NOT NULL`);
    console.log("✓ Made clerk_id nullable");
  } catch (e: any) {
    console.log("✓ clerk_id already nullable or column doesn't exist");
  }

  // 4. Create sessions table
  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token       TEXT UNIQUE NOT NULL,
      expires_at  TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log("✓ Created sessions table");

  // 5. Create indexes
  await query(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
  console.log("✓ Created session indexes");

  // 5.5 Ensure email has unique constraint
  try {
    await query(`ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email)`);
    console.log("✓ Added unique constraint on users.email");
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      console.log("✓ users.email unique constraint already exists");
    } else {
      console.log("⚠ Could not add unique constraint:", e.message);
    }
  }

  // 5.6 Update role CHECK constraint to allow 'admin' and 'citizen'
  try {
    await query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
    await query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'citizen', 'lrb', 'collector', 'state_admin', 'central_ministry'))`);
    console.log("✓ Updated role CHECK constraint to include 'admin'");
  } catch (e: any) {
    console.log("⚠ Could not update role constraint:", e.message);
  }

  // 6. Seed admin account
  const adminHash = await bcrypt.hash("admin123", 10);
  await query(
    `INSERT INTO users (email, password_hash, role, name)
     VALUES ($1, $2, 'admin', 'System Administrator')
     ON CONFLICT (email) DO UPDATE SET password_hash = $2, role = 'admin', name = 'System Administrator'`,
    ["admin@bhumisetu.gov.in", adminHash]
  );
  console.log("✓ Seeded admin: admin@bhumisetu.gov.in / admin123");

  // 7. Seed citizen account
  const citizenHash = await bcrypt.hash("citizen123", 10);
  await query(
    `INSERT INTO users (email, password_hash, role, name)
     VALUES ($1, $2, 'citizen', 'Demo Citizen')
     ON CONFLICT (email) DO UPDATE SET password_hash = $2, role = 'citizen', name = 'Demo Citizen'`,
    ["citizen@bhumisetu.gov.in", citizenHash]
  );
  console.log("✓ Seeded citizen: citizen@bhumisetu.gov.in / citizen123");

  console.log("\n✅ Migration 0004 complete!");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
