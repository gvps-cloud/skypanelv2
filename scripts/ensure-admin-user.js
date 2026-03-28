import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function ensureAdminUser() {
  try {
    const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin123#';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    console.log(`Checking for user: ${email}`);
    
    // Check if user exists
    const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (res.rows.length === 0) {
      console.log('User not found. Creating...');
      // Removed is_verified as it does not exist in the schema
      // Changed password to password_hash
      await pool.query(`
        INSERT INTO users (email, password_hash, role, name)
        VALUES ($1, $2, 'admin', 'Admin User')
      `, [email, hashedPassword]);
      console.log('✅ Admin user created.');
    } else {
      console.log('User exists. Updating password...');
      // Removed is_verified as it does not exist in the schema
      // Changed password to password_hash
      await pool.query(`
        UPDATE users 
        SET password_hash = $1, role = 'admin'
        WHERE email = $2
      `, [hashedPassword, email]);
      console.log('✅ Admin user password updated.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

ensureAdminUser();
