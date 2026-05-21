const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/popper_dev',
  max: 2,
});

pool.query('SELECT table_name FROM information_schema.tables WHERE table_schema="public"', (err, res) => {
  if (err) {
    console.error('Database error:', err.message);
  } else {
    console.log('Tables in database:', res.rows);
  }
  pool.end();
});

setTimeout(() => {
  console.error('Timeout - database not responding');
  pool.end();
  process.exit(1);
}, 5000);
