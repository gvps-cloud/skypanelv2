import pg from 'pg';
import fetch from 'node-fetch';
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

const adminEmail = (process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com').trim();
const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';

async function verifyAdmin() {
  try {
    console.log(`🔍 Checking database for ${adminEmail}...`);
    const res = await pool.query('SELECT id, email, role, password_hash FROM users WHERE email = $1', [adminEmail]);
    
    if (res.rows.length > 0) {
      console.log('✅ User found in database:');
      console.log(`   ID: ${res.rows[0].id}`);
      console.log(`   Role: ${res.rows[0].role}`);
      console.log(`   Has Password Hash: ${!!res.rows[0].password_hash}`);
      
      console.log(`\n🔄 Attempting API Login...`);
      const loginRes = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword })
      });
      
      if (loginRes.ok) {
        console.log('✅ API Login Successful!');
        const data = await loginRes.json();
        console.log('   Token received.');
      } else {
        console.log(`❌ API Login Failed: ${loginRes.status} ${loginRes.statusText}`);
        const text = await loginRes.text();
        console.log(`   Response: ${text}`);
      }
      
    } else {
      console.log(`❌ User ${adminEmail} NOT found in database.`);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

verifyAdmin();
