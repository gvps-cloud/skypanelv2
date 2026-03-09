import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function verifyColumn() {
  const client = new Client(process.env.DATABASE_URL);
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Check column exists
    const columnQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'active_organization_id'
    `;
    const columnResult = await client.query(columnQuery);
    
    if (columnResult.rows.length > 0) {
      console.log('\n✅ Column active_organization_id exists:');
      console.log(JSON.stringify(columnResult.rows[0], null, 2));
    } else {
      console.log('\n❌ Column active_organization_id not found');
    }
    
    // Check foreign key constraint
    const fkQuery = `
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.table_name = 'users' 
        AND kcu.column_name = 'active_organization_id'
        AND tc.constraint_type = 'FOREIGN KEY'
    `;
    const fkResult = await client.query(fkQuery);
    
    if (fkResult.rows.length > 0) {
      console.log('\n✅ Foreign key constraint exists:');
      console.log(JSON.stringify(fkResult.rows[0], null, 2));
    } else {
      console.log('\n❌ Foreign key constraint not found');
    }
    
    // Check index
    const indexQuery = `
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'users' AND indexname = 'idx_users_active_organization_id'
    `;
    const indexResult = await client.query(indexQuery);
    
    if (indexResult.rows.length > 0) {
      console.log('\n✅ Index exists:');
      console.log(JSON.stringify(indexResult.rows[0], null, 2));
    } else {
      console.log('\n❌ Index not found');
    }
    
    console.log('\n🎉 Verification complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

verifyColumn();
