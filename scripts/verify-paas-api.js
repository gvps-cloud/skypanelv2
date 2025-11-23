import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001/api';
const ADMIN_EMAIL = 'admin@skypanelv2.com';
const ADMIN_PASSWORD = 'admin123';
const CLIENT_EMAIL = 'client@example.com';
const CLIENT_PASSWORD = 'clientpassword';

async function login(email, password) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  if (!data.token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  }
  return data.token;
}

async function verify() {
  try {
    console.log('🚀 Starting PaaS API Verification...');

    // 1. Login as Admin
    console.log('🔑 Logging in as Admin...');
    const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('✅ Admin logged in');

    // 2. Get Existing Worker Node
    console.log('🏗️ Getting Worker Node...');
    const workersRes = await fetch(`${API_URL}/admin/paas/workers`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    const workersData = await workersRes.json();
    if (!workersData.success || workersData.workers.length === 0) {
      throw new Error('No worker nodes found. Please ensure at least one worker is registered.');
    }
    
    const workerId = workersData.workers[0].id;
    console.log(`✅ Using Worker Node: ${workersData.workers[0].name} (${workerId})`);

    /* 
    // Skip creation since we are using existing worker
    const workerRes = await fetch(`${API_URL}/admin/paas/workers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'test-worker-1',
        hostIp: '192.168.1.100',
        sshPort: 22,
        sshUser: 'root',
        sshKeyPath: '/root/.ssh/id_rsa',
        capacityCpu: 4,
        capacityMemoryMb: 8192,
        capacityDiskGb: 100,
        region: 'local'
      })
    });

    const workerData = await workerRes.json();
    if (!workerData.success) {
      throw new Error(`Failed to create worker: ${JSON.stringify(workerData)}`);
    }
    const workerId = workerData.worker.id;
    console.log(`✅ Worker Created: ${workerData.worker.name} (${workerId})`);
    */

    // 3. Login as Client
    console.log('🔑 Logging in as Client...');
    // Ensure client exists (you might need to register first if not exists, but assuming seeded)
    // For this script, we assume client exists. If not, we should register.
    let clientToken;
    try {
      clientToken = await login(CLIENT_EMAIL, CLIENT_PASSWORD);
    } catch (e) {
      console.log('⚠️ Client login failed, trying to register...');
      const regRes = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: CLIENT_EMAIL, 
          password: CLIENT_PASSWORD,
          firstName: 'Test',
          lastName: 'Client'
        })
      });
      const regData = await regRes.json();
      if (!regData.token) throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
      clientToken = regData.token;
    }
    console.log('✅ Client logged in');

    // 4. Create Application
    console.log('🚀 Creating Application...');
    const appRes = await fetch(`${API_URL}/client/paas/applications`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clientToken}`
      },
      body: JSON.stringify({
        name: 'test-app-1',
        deploymentStrategy: 'image',
        imageUrl: 'nginx:latest',
        targetWorkerNodeId: workerId,
        appPort: 80,
        cpuLimit: 0.5,
        memoryLimitMb: 128
      })
    });
    const appData = await appRes.json();
    if (!appData.success) throw new Error(`Failed to create app: ${JSON.stringify(appData)}`);
    const appId = appData.application.id;
    console.log(`✅ Application created: ${appId}`);

    // 5. Get Application Details
    console.log('🔍 Getting Application Details...');
    const getAppRes = await fetch(`${API_URL}/client/paas/applications/${appId}`, {
      headers: { 'Authorization': `Bearer ${clientToken}` }
    });
    const getAppData = await getAppRes.json();
    if (!getAppData.success) throw new Error(`Failed to get app: ${JSON.stringify(getAppData)}`);
    console.log('✅ Application details retrieved');

    // 6. Get Application Stats
    console.log('📊 Getting Application Stats...');
    const statsRes = await fetch(`${API_URL}/client/paas/applications/${appId}/stats`, {
      headers: { 'Authorization': `Bearer ${clientToken}` }
    });
    const statsData = await statsRes.json();
    if (!statsData.success) throw new Error(`Failed to get stats: ${JSON.stringify(statsData)}`);
    console.log('✅ Application stats retrieved:', statsData.stats);

    // 7. Delete Application
    console.log('🗑️ Deleting Application...');
    const delAppRes = await fetch(`${API_URL}/client/paas/applications/${appId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${clientToken}` }
    });
    const delAppData = await delAppRes.json();
    if (!delAppData.success) throw new Error(`Failed to delete app: ${JSON.stringify(delAppData)}`);
    console.log('✅ Application deleted');

    // 8. Cleanup Worker (skipped - worker should persist for future tests)
    console.log('🧹 Worker cleanup skipped (worker persists for reuse)');
    /* 
    const delWorkerRes = await fetch(`${API_URL}/admin/paas/workers/${workerId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const delWorkerData = await delWorkerRes.json();
    if (!delWorkerData.success) throw new Error(`Failed to delete worker: ${JSON.stringify(delWorkerData)}`);
    console.log('✅ Worker deleted');
    */

    console.log('🎉 Verification Completed Successfully!');
  } catch (error) {
    console.error('❌ Verification Failed:', error);
    process.exit(1);
  }
}

verify();
