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

async function checkConstraint() {
  try {
    console.log('\n🔍 Checking constraints on paas_applications...');
    const res = await pool.query("SELECT conname, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid = 'paas_applications'::regclass");
    if (res.rows.length > 0) {
      res.rows.forEach(row => {
        console.log(`Constraint ${row.conname}: ${row.def}`);
      });
    } else {
      console.log('❌ No constraints found');
    }
  } catch (error) {
    console.error('❌ Error checking constraints:', error);
  }
}

async function run() {
  await checkConstraint();
  await pool.end();
}

run();
