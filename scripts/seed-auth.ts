/**
 * BhoomiSetu — Seed Script
 * Run: npx tsx scripts/seed-auth.ts
 * Creates default admin and citizen accounts with proper bcrypt hashes
 */

import bcrypt from "bcryptjs";
import { query } from "../lib/db/pool";

async function seed() {
  console.log("Seeding auth accounts...");

  const adminHash = await bcrypt.hash("admin123", 10);
  const citizenHash = await bcrypt.hash("citizen123", 10);

  // Seed admin
  await query(
    `INSERT INTO users (email, password_hash, role, name)
     VALUES ($1, $2, 'admin', 'System Administrator')
     ON CONFLICT (email) DO UPDATE SET password_hash = $2, role = 'admin', name = 'System Administrator'`,
    ["admin@bhumisetu.gov.in", adminHash]
  );
  console.log("✓ Admin: admin@bhumisetu.gov.in / admin123");

  // Seed citizen
  await query(
    `INSERT INTO users (email, password_hash, role, name)
     VALUES ($1, $2, 'citizen', 'Demo Citizen')
     ON CONFLICT (email) DO UPDATE SET password_hash = $2, role = 'citizen', name = 'Demo Citizen'`,
    ["citizen@bhumisetu.gov.in", citizenHash]
  );
  console.log("✓ Citizen: citizen@bhumisetu.gov.in / citizen123");

  console.log("\nDone! Accounts seeded successfully.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
