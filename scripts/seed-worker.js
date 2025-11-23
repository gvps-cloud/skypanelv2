import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seedWorker() {
  try {
    // Check if worker exists
    const res = await pool.query('SELECT * FROM paas_worker_nodes LIMIT 1');
    const res = await pool.query('SELECT * FROM paas_applications LIMIT 1');
    if (res.rows.length > 0) {
      console.log('✅ Worker already exists:', res.rows[0].id);
      return;
    }

    // Insert with correct columns
    // ID is likely serial, so we omit it
    await pool.query(`
      INSERT INTO paas_applications (
        name, ssh_host, ssh_port, ssh_user, ssh_key_path, 
        cpu_cores, ram_mb, disk_gb, 
        region, status, health_status, uncloud_context, 
        created_at, updated_at, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW(), $13
      )
    `, [
      'test-worker-1',
      '127.0.0.1',
      22,
      'root',
      '/root/.ssh/id_rsa',
      4,
      8192,
      100,
      'local',
      'active',
      'healthy',
      'default',
      1 // Assuming admin user ID is 1
    ]);

    console.log('✅ Seeded worker successfully');
  } catch (error) {
    console.error('❌ Error seeding worker:', error);
  } finally {
    await pool.end();
  }
}

seedWorker();
