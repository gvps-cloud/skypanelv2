import { query } from '../api/lib/database.ts';

async function checkApps() {
  try {
    const result = await query(
      "SELECT id, name, status, deploy_method FROM paas_applications WHERE status != $1",
      ['deleted']
    );
    console.log(`\n📱 Applications in database: ${result.rows.length}\n`);
    
    if (result.rows.length > 0) {
      result.rows.forEach(app => {
        console.log(`App: ${app.name}`);
        console.log(`  ID: ${app.id}`);
        console.log(`  Status: ${app.status}`);
        console.log(`  Deploy method: ${app.deploy_method}`);
        console.log('');
      });
    } else {
      console.log('No applications deployed yet ✨\n');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkApps();
