import { PaaSWorkerService } from '../api/services/paasWorkerService.js';
import dotenv from 'dotenv';

dotenv.config();

async function testHealthCheck() {
  console.log('🏥 Testing worker health check...\n');
  
  // Get the first worker
  const workers = await PaaSWorkerService.getAllWorkers();
  if (workers.length === 0) {
    console.log('❌ No workers found');
    return;
  }
  
  const worker = workers[0];
  console.log(`Worker: ${worker.name} (ID: ${worker.id})`);
  console.log(`Context: ${worker.uncloudContext}`);
  console.log(`Current Health: ${worker.healthStatus || 'unknown'}\n`);
  
  // Perform health check
  console.log('Running health check...');
  const success = await PaaSWorkerService.performHealthCheck(worker.id);
  
  if (success) {
    // Get updated worker
    const updated = await PaaSWorkerService.getWorkerById(worker.id);
    console.log('\n✅ Health check completed');
    console.log(`New Health Status: ${updated?.healthStatus || 'unknown'}`);
    console.log(`CPU: ${updated?.cpuTotal || 'N/A'}`);
    console.log(`Memory: ${updated?.memoryTotalGb || 'N/A'} GB`);
    console.log(`Disk: ${updated?.diskTotalGb || 'N/A'} GB`);
  } else {
    console.log('\n❌ Health check failed');
  }
}

testHealthCheck().catch(console.error);
