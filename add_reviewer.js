const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const hash = await bcrypt.hash('admin123', 10);
  await pool.query(
    `INSERT INTO gh_users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, name = EXCLUDED.name`,
    ['reviewer@gmail.com', hash, 'Land Records Reviewer', 'reviewer']
  );
  console.log('User upserted: reviewer@gmail.com / admin123 (role: reviewer)');
  await pool.end();
}

main().catch(e => { console.error('Error:', e.message); pool.end(); });
