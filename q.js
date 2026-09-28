// Read-only DB query helper.
// Usage: node q.js "SELECT ..." [app|geo|auth]
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
require('dotenv').config({ path: path.join(__dirname, 'geo-engine', '.env') });
require('dotenv').config({ path: path.join(__dirname, 'db', '.env') });
const { Pool } = require('pg');
const which = process.argv[3] || 'app';
let url = process.env.DATABASE_URL;
if (which === 'geo') {
  const geoEnv = fs.readFileSync(path.join(__dirname, 'geo-engine', '.env'), 'utf8');
  const m = geoEnv.match(/^DATABASE_URL\s*=\s*(.+)$/m);
  if (m) url = m[1].trim().replace(/^["']|["']$/g, '');
}
if (!url) { console.error('No URL for ' + which); process.exit(1); }
const pool = new Pool({ connectionString: url });
pool.query(process.argv[2])
  .then(r => { console.log(JSON.stringify(r.rows, null, 2)); if (r.rows.length === 0) console.log('(0 rows)'); })
  .catch(e => { console.error('ERR:', e.message); })
  .finally(() => pool.end());
