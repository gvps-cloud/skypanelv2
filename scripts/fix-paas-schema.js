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

async function fixSchema() {
  try {
    console.log('🔧 Fixing PaaS schema...');

    // Check if paas_applications is empty
    const res = await pool.query('SELECT count(*) FROM paas_applications');
    const count = parseInt(res.rows[0].count);
    console.log(`Found ${count} rows in paas_applications`);

    if (count > 0) {
      console.log('⚠️ Table not empty. Truncating to allow schema change...');
      await pool.query('TRUNCATE TABLE paas_applications CASCADE');
    }

    // Alter user_id to UUID
    console.log('🔄 Altering user_id to UUID...');
    
    // Drop and recreate column
    await pool.query('ALTER TABLE paas_applications DROP COLUMN user_id');
    await pool.query('ALTER TABLE paas_applications ADD COLUMN user_id UUID');

    console.log('✅ Schema fixed successfully');
  } catch (error) {
    console.error('❌ Error fixing schema:', error);
  } finally {
    await pool.end();
  }
}

fixSchema();
