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

const tables = [
  'paas_worker_nodes',
  'paas_applications',
  'paas_app_ports',
  'paas_app_env_vars',
  'paas_deployments',
  'paas_deployment_logs',
  'paas_addons',
  'paas_addon_types',
  'paas_marketplace_templates',
  'paas_pricing_plans',
  'paas_usage_records'
];

async function verifyAllTables() {
  console.log('🔍 Verifying all PaaS tables...\n');
  
  for (const table of tables) {
    try {
      const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      
      if (res.rows.length === 0) {
        console.log(`❌ ${table}: TABLE DOES NOT EXIST`);
      } else {
        console.log(`✅ ${table}: ${res.rows.length} columns`);
        console.log(`   Columns: ${res.rows.map(r => r.column_name).join(', ')}\n`);
      }
    } catch (error) {
      console.log(`❌ ${table}: ERROR - ${error.message}\n`);
    }
  }
  
  await pool.end();
  console.log('✅ Verification complete');
}

verifyAllTables();
