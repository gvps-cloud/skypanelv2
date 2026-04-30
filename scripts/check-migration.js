import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function checkMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔍 Checking if active_organization_id column exists...');
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users' 
      AND column_name = 'active_organization_id'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Column exists!');
      console.log('Column details:', result.rows[0]);
    } else {
      console.log('❌ Column does NOT exist!');
      console.log('Migration needs to be run: npm run db:fresh');
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking migration:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkMigration();
