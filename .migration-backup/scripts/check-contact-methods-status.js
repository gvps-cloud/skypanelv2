/**
 * Check the status of all contact methods in the database
 */
import { query } from '../api/lib/database.js';

async function checkContactMethodsStatus() {
  try {
    console.log('Checking contact methods status in database...\n');
    
    const result = await query(
      `SELECT method_type, title, is_active, 
              jsonb_object_keys(config) as config_keys
       FROM contact_methods 
       ORDER BY method_type`
    );
    
    console.log('Contact Methods in Database:');
    console.log('============================\n');
    
    for (const row of result.rows) {
      console.log(`${row.method_type.toUpperCase()}`);
      console.log(`  Title: ${row.title}`);
      console.log(`  Active: ${row.is_active ? '✓' : '✗'}`);
      console.log();
    }
    
    const activeCount = result.rows.filter(r => r.is_active).length;
    const inactiveCount = result.rows.filter(r => !r.is_active).length;
    
    console.log(`Total: ${result.rows.length} methods`);
    console.log(`Active: ${activeCount}`);
    console.log(`Inactive: ${inactiveCount}\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkContactMethodsStatus();
