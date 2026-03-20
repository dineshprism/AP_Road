import bcrypt from 'bcrypt';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:Github%2320262027@localhost:5432/road_accident_db',
});

async function main() {
  const hash = await bcrypt.hash('Admin@123', 10);
  const result = await pool.query(
    'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING email',
    [hash, 'dinesh@gmail.com']
  );
  console.log('Updated:', result.rows[0].email);
  console.log('Hash:', hash);

  // Verify
  const check = await pool.query('SELECT password_hash FROM users WHERE email = $1', ['dinesh@gmail.com']);
  const matches = await bcrypt.compare('Admin@123', check.rows[0].password_hash);
  console.log('Verify match:', matches);

  await pool.end();
}

main().catch(console.error);