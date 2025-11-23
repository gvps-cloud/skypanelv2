import { query } from '../api/lib/database.ts';

async function checkWorkers() {
  try {
    const result = await query('SELECT id, name, ssh_host, uncloud_context, status FROM paas_worker_nodes');
    console.log(`\n📊 Workers in database: ${result.rows.length}\n`);
    
    if (result.rows.length > 0) {
      result.rows.forEach(worker => {
        console.log(`Worker: ${worker.name}`);
        console.log(`  ID: ${worker.id}`);
        console.log(`  Host: ${worker.ssh_host}`);
        console.log(`  Context: ${worker.uncloud_context}`);
        console.log(`  Status: ${worker.status}`);
        console.log('');
      });
    } else {
      console.log('✨ No workers registered yet - ready to add your first one!\n');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkWorkers();
