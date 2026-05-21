const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres@localhost:5432/popper_dev',
});

pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' LIMIT 1", (err, res) => {
  if (err) {
    console.error('❌ Database error:', err.message);
  } else if (res.rows.length > 0) {
    console.log('✅ Database connected! Found tables:', res.rows.length);
  } else {
    console.log('❌ No tables found');
  }
  pool.end();
  process.exit(res && res.rows.length > 0 ? 0 : 1);
});

setTimeout(() => {
  console.error('❌ Timeout');
  pool.end();
  process.exit(1);
}, 5000);
