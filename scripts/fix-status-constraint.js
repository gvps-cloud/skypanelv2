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

async function fixConstraint() {
  try {
    console.log('🔧 Fixing valid_status constraint...');

    // Drop existing constraint
    await pool.query('ALTER TABLE paas_applications DROP CONSTRAINT valid_status');
    
    // Add new constraint with 'deleted'
    await pool.query(`
      ALTER TABLE paas_applications 
      ADD CONSTRAINT valid_status 
      CHECK (status IN ('inactive', 'pending', 'deploying', 'running', 'stopped', 'error', 'deleting', 'deleted'))
    `);
    // I added 'pending' back just in case, and 'deleted'.

    console.log('✅ Constraint updated successfully');
  } catch (error) {
    console.error('❌ Error fixing constraint:', error);
  } finally {
    await pool.end();
  }
}

fixConstraint();
