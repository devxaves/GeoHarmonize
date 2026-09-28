import { Pool } from "pg";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_sVya1twpTW0j@ep-summer-mud-a14088y5-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
});

const GEO_ENGINE_URL = process.env.GEO_ENGINE_URL || "http://localhost:8000";

async function seedUsers() {
  console.log("Hashing password...");
  const hash = await bcrypt.hash("admin123", 10);

  console.log("Creating tables if not exists...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gh_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        role TEXT NOT NULL CHECK (role IN ('admin','reviewer','viewer')),
        created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gh_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES gh_users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  console.log("Upserting users...");
  await pool.query(`
    INSERT INTO gh_users (email, password_hash, name, role)
    VALUES ('admin@geoharmonize.gov.in', $1, 'System Administrator', 'admin')
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
  `, [hash]);

  await pool.query(`
    INSERT INTO gh_users (email, password_hash, name, role)
    VALUES ('reviewer@geoharmonize.gov.in', $1, 'Land Records Reviewer', 'reviewer')
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
  `, [hash]);

  await pool.query(`
    INSERT INTO gh_users (email, password_hash, name, role)
    VALUES ('viewer@geoharmonize.gov.in', $1, 'Data Viewer', 'viewer')
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
  `, [hash]);

  console.log("Users seeded successfully.");
}

async function seedGeoEngine() {
  console.log("Seeding geo-engine data...");

  const sampleDir = path.join(process.cwd(), "geo-engine", "sample_data");
  const legacyPath = path.join(sampleDir, "legacy_cadastral.geojson");
  const dronePath = path.join(sampleDir, "new_drone_survey.geojson");

  if (!fs.existsSync(legacyPath) || !fs.existsSync(dronePath)) {
    console.log("Sample data files not found. Run 'python geo-engine/scripts/seed_data.py' first.");
    return;
  }

  console.log("Uploading legacy cadastral layer...");
  const legacyBlob = new Blob([fs.readFileSync(legacyPath)], { type: "application/geo+json" });
  const formA = new FormData();
  formA.append("file", legacyBlob, "legacy_cadastral.geojson");
  formA.append("source_type", "cadastral");
  formA.append("declared_crs", "EPSG:4326");
  formA.append("uploaded_by", "seed_script");

  const upResA = await fetch(`${GEO_ENGINE_URL}/api/geo/datasets/upload`, {
    method: "POST",
    body: formA,
  });
  if (!upResA.ok) throw new Error(`Upload A failed: ${await upResA.text()}`);
  const dataA = await upResA.json();
  console.log(`  Uploaded: ${dataA.feature_count} features`);

  console.log("Harmonizing legacy cadastral...");
  const harmResA = await fetch(
    `${GEO_ENGINE_URL}/api/geo/datasets/${dataA.dataset_id}/harmonize?state=MH&district=PUNE&ulb=PMC&ward=W01`,
    { method: "POST" }
  );
  if (!harmResA.ok) throw new Error(`Harmonize A failed: ${await harmResA.text()}`);
  const harmDataA = await harmResA.json();
  console.log(`  Parcels inserted: ${harmDataA.parcels_inserted}`);

  console.log("Uploading drone survey layer...");
  const droneBlob = new Blob([fs.readFileSync(dronePath)], { type: "application/geo+json" });
  const formB = new FormData();
  formB.append("file", droneBlob, "new_drone_survey.geojson");
  formB.append("source_type", "drone_ori");
  formB.append("declared_crs", "EPSG:4326");
  formB.append("uploaded_by", "seed_script");

  const upResB = await fetch(`${GEO_ENGINE_URL}/api/geo/datasets/upload`, {
    method: "POST",
    body: formB,
  });
  if (!upResB.ok) throw new Error(`Upload B failed: ${await upResB.text()}`);
  const dataB = await upResB.json();
  console.log(`  Uploaded: ${dataB.feature_count} features`);

  console.log("Harmonizing drone survey...");
  const harmResB = await fetch(
    `${GEO_ENGINE_URL}/api/geo/datasets/${dataB.dataset_id}/harmonize?state=MH&district=PUNE&ulb=PMC&ward=W01`,
    { method: "POST" }
  );
  if (!harmResB.ok) throw new Error(`Harmonize B failed: ${await harmResB.text()}`);
  const harmDataB = await harmResB.json();
  console.log(`  Conflicts generated: ${harmDataB.conflicts_generated}`);
  console.log(`  Auto-linked: ${harmDataB.auto_linked}`);
  console.log(`  Flagged for review: ${harmDataB.flagged_for_review}`);

  console.log("Geo-engine seeded successfully.");
}

async function main() {
  try {
    await seedUsers();
    await seedGeoEngine();
    console.log("\nSEEDING_SUCCESSFUL");
  } catch (err) {
    console.error("SEED_ERROR:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
