import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config();
const { Pool } = pg;

async function run() {
  console.log('🔐 Updating admin password hash to bcryptjs(12) for "admin123"...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    const client = await pool.connect();
    const password = 'admin123';
    const saltRounds = 12;
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('🧾 New hash prefix:', hash.slice(0, 10));

    const { rowCount } = await client.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2',
      [hash, 'admin@example.com']
    );

    if (rowCount === 0) {
      console.log('❌ Admin user not found, cannot update password');
    } else {
      console.log('✅ Admin password updated');
      const { rows } = await client.query(
        'SELECT password_hash FROM users WHERE email = $1',
        ['admin@example.com']
      );
      const ok = await bcrypt.compare(password, rows[0].password_hash);
      console.log('🧪 Post-update compare("admin123") =>', ok);
    }

    client.release();
  } catch (err) {
    console.error('❌ Update failed:', err);
  } finally {
    await pool.end();
  }
}

run();