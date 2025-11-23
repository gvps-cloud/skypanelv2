
import { UnregistryService } from '../api/services/unregistryService.js';
import { PaaSWorkerService } from '../api/services/paasWorkerService.js';
import { query } from '../api/lib/database.js'; // Ensure DB connection

async function test() {
  try {
    console.log('Testing Unregistry...');
    const workers = await PaaSWorkerService.getAllWorkers();
    if (workers.length === 0) {
      console.log('No workers found');
      return;
    }
    
    const worker = workers[0];
    console.log(`Testing worker: ${worker.name} (${worker.hostIp})`);
    
    const config = {
      remoteHost: worker.hostIp,
      remoteUser: worker.sshUser,
      remotePort: worker.sshPort,
      sshKeyPath: worker.sshKeyPath
    };
    
    const connected = await UnregistryService.testConnection(config);
    console.log('SSH Connection:', connected);
    
    if (connected) {
        const dockerInfo = await UnregistryService.getRemoteDockerInfo(config);
        console.log('Remote Docker:', dockerInfo.success ? 'OK' : dockerInfo.error);
        
        // Check remote images
        const images = await UnregistryService.listRemoteImages(config);
        console.log('Remote Images:', images.success ? images.images.length : images.error);
    }
    
  } catch (err) {
    console.error(err);
  }
}

test().then(() => process.exit(0));
