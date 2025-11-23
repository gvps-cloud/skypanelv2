import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function createMissingTables() {
  try {
    console.log('Creating missing PaaS tables...\n');
    
    // 1. paas_deployment_logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS paas_deployment_logs (
        id SERIAL PRIMARY KEY,
        deployment_id INTEGER NOT NULL REFERENCES paas_deployments(id) ON DELETE CASCADE,
        timestamp TIMESTAMP DEFAULT NOW(),
        log_level VARCHAR(20) DEFAULT 'info',
        message TEXT,
        metadata JSONB DEFAULT '{}'
      )
    `);
    console.log('✅ Created paas_deployment_logs');
    
    //2. paas_addon_types
    await pool.query(`
      CREATE TABLE IF NOT EXISTS paas_addon_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        icon_url TEXT,
        docker_image VARCHAR(255),
        default_port INTEGER,
        default_config JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Created paas_addon_types');
    
    // 3. paas_usage_records
    await pool.query(`
      CREATE TABLE IF NOT EXISTS paas_usage_records (
        id SERIAL PRIMARY KEY,
        application_id INTEGER NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL,
        record_type VARCHAR(50) NOT NULL,
        cpu_hours DECIMAL(10,4) DEFAULT 0,
        ram_gb_hours DECIMAL(10,4) DEFAULT 0,
        disk_gb_hours DECIMAL(10,4) DEFAULT 0,
        bandwidth_gb DECIMAL(10,4) DEFAULT 0,
        amount DECIMAL(10,2) DEFAULT 0,
        period_start TIMESTAMP NOT NULL,
        period_end TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Created paas_usage_records');
    
    console.log('\n✅ All missing tables created');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

createMissingTables();
