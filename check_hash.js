const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_sVya1twpTW0j@ep-summer-mud-a14088y5-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
});

async function main() {
  const r = await pool.query('SELECT email, password_hash FROM gh_users WHERE email = $1', ['admin@geoharmonize.gov.in']);
  const hash = r.rows[0].password_hash;
  console.log('Stored hash:', hash);
  console.log('Hash length:', hash.length);
  const match = await bcrypt.compare('admin123', hash);
  console.log('Password match:', match);

  const newHash = await bcrypt.hash('admin123', 10);
  console.log('Fresh hash:', newHash);
  console.log('Fresh match:', await bcrypt.compare('admin123', newHash));

  await pool.end();
}

main().catch(e => { console.error('Error:', e.message); pool.end(); });
