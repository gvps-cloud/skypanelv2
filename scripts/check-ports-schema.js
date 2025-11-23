
import pg from 'pg';
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

async function checkSchema() {
  try {
    console.log('Checking paas_app_ports schema...');
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'paas_app_ports'
    `);
    
    console.log('Columns:', res.rows.map(r => r.column_name).join(', '));
    
    const hasCustomDomain = res.rows.some(r => r.column_name === 'custom_domain');
    if (hasCustomDomain) {
      console.log('✅ custom_domain column exists');
    } else {
      console.log('❌ custom_domain column MISSING');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkSchema();
