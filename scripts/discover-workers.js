import { query } from '../api/lib/database.js';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Discover and register existing uncloud workers
 * Useful after database resets when clusters already exist
 */
async function discoverWorkers() {
  console.log('🔍 Discovering existing uncloud workers...\n');

  try {
    // Get list of uncloud contexts
    const contextsOutput = execSync('uc context ls', { encoding: 'utf-8' });
    console.log('Uncloud contexts:');
    console.log(contextsOutput);

    // Parse contexts (format: NAME      CURRENT   CONNECTIONS)
    const lines = contextsOutput.trim().split('\n').slice(1); // Skip header
    const contexts = [];

    for (const line of lines) {
      const match = line.match(/^(\S+)\s+(✓)?\s+(\d+)/);
      if (match) {
        const [, name, current, connections] = match;
        contexts.push({ name, current: !!current, connections: parseInt(connections) });
      }
    }

    if (contexts.length === 0) {
      console.log('❌ No uncloud contexts found. Initialize a cluster first with `uc machine init`\n');
      process.exit(1);
    }

    console.log(`\nFound ${contexts.length} context(s):\n`);
    contexts.forEach(ctx => {
      console.log(`  - ${ctx.name}${ctx.current ? ' (current)' : ''} - ${ctx.connections} connection(s)`);
    });

    // For each context, get machine details
    for (const ctx of contexts) {
      console.log(`\n📡 Checking context: ${ctx.name}`);
      
      try {
        const machinesOutput = execSync(`uc machine ls -c ${ctx.name}`, { encoding: 'utf-8' });
        console.log(machinesOutput);

        // Parse machine list to get SSH details
        // Format: NAME           STATE   ADDRESS         PUBLIC IP        WIREGUARD
        const machineLines = machinesOutput.trim().split('\n').slice(1);
        
        for (const machineLine of machineLines) {
          const parts = machineLine.trim().split(/\s+/);
          if (parts.length >= 4) {
            const machineName = parts[0];
            const state = parts[1];
            const privateIp = parts[2].split('/')[0]; // Remove CIDR
            const publicIp = parts[3];

            console.log(`\n  Machine: ${machineName}`);
            console.log(`  State: ${state}`);
            console.log(`  Private IP: ${privateIp}`);
            console.log(`  Public IP: ${publicIp}`);

            // Check if worker already exists in database
            const existing = await query(
              'SELECT id, name FROM paas_worker_nodes WHERE uncloud_context = $1',
              [ctx.name]
            );

            if (existing.rows.length > 0) {
              console.log(`  ℹ️  Worker already registered in database: ${existing.rows[0].name} (${existing.rows[0].id})`);
              continue;
            }

            // Register worker in database
            const workerName = ctx.name; // Use context name as worker name
            const sshUser = 'root'; // Default, can be overridden
            const sshKeyPath = process.env.SSH_KEY_PATH || '/root/.ssh/id_ed25519';

            console.log(`\n  ✨ Registering worker in database...`);
            console.log(`     Name: ${workerName}`);
            console.log(`     Context: ${ctx.name}`);
            console.log(`     Host IP: ${publicIp}`);
            console.log(`     SSH User: ${sshUser}`);

            const result = await query(
              `INSERT INTO paas_worker_nodes 
               (name, ssh_host, ssh_port, ssh_user, ssh_key_path, uncloud_context, uncloud_machine_name, 
                public_ip, private_ip, is_control_plane, status, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
               RETURNING id, name`,
              [workerName, publicIp, 22, sshUser, sshKeyPath, ctx.name, machineName, publicIp, privateIp, true, 'active']
            );

            console.log(`  ✅ Worker registered: ${result.rows[0].name} (${result.rows[0].id})`);
          }
        }
      } catch (error) {
        console.error(`  ❌ Failed to get machines for context ${ctx.name}:`, error.message);
      }
    }

    console.log('\n✨ Worker discovery complete!\n');
    console.log('💡 Tip: Run `npx tsx scripts/check-workers.js` to verify workers in database\n');

  } catch (error) {
    console.error('❌ Error discovering workers:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

discoverWorkers();
