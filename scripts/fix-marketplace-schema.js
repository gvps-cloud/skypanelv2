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

async function fixMarketplaceTemplatesSchema() {
  try {
    console.log('🔍 Checking paas_marketplace_templates schema...\n');
    
    // Check current columns
    const columnsRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'paas_marketplace_templates'
      ORDER BY ordinal_position
    `);
    
    const columns = columnsRes.rows.map(r => r.column_name);
    console.log('Current columns:', columns.join(', '));
    
    // Check if deployment_strategy exists
    if (!columns.includes('deployment_strategy')) {
      console.log('\n❌ Missing column: deployment_strategy');
      console.log('Adding deployment_strategy column...');
      
      await pool.query(`
        ALTER TABLE paas_marketplace_templates 
        ADD COLUMN IF NOT EXISTS deployment_strategy VARCHAR(50) DEFAULT 'buildpack'
      `);
      
      console.log('✅ Added deployment_strategy column');
    } else {
      console.log('\n✅ deployment_strategy column exists');
    }
    
    // Verify all expected columns exist
    const expectedColumns = [
      'id', 'name', 'description', 'category', 'language', 'framework',
      'logo_url', 'repository_url', 'repository_branch', 'deployment_strategy',
      'buildpack_builder', 'custom_buildpacks', 'dockerfile_path', 'image_url',
      'app_port', 'environment_variables', 'required_addons', 'min_cpu_cores',
      'min_memory_mb', 'is_active', 'created_at', 'updated_at'
    ];
    
    const missing = expectedColumns.filter(col => !columns.includes(col));
    
    if (missing.length > 0) {
      console.log('\n⚠️  Missing columns:', missing.join(', '));
      
      // Add missing columns
      for (const col of missing) {
        let colDef = '';
        switch(col) {
          case 'deployment_strategy':
            colDef = "VARCHAR(50) DEFAULT 'buildpack'";
            break;
          case 'buildpack_builder':
          case 'dockerfile_path':
          case 'image_url':
            colDef = 'TEXT';
            break;
          case 'custom_buildpacks':
          case 'required_addons':
            colDef = 'TEXT[]';
            break;
          case 'app_port':
          case 'min_cpu_cores':
            colDef = 'INTEGER';
            break;
          case 'min_memory_mb':
            colDef = 'INTEGER DEFAULT 512';
            break;
          case 'environment_variables':
            colDef = 'JSONB DEFAULT \'{}\'';
            break;
          case 'is_active':
            colDef = 'BOOLEAN DEFAULT true';
            break;
          case 'created_at':
          case 'updated_at':
            colDef = 'TIMESTAMP DEFAULT NOW()';
            break;
          default:
            colDef = 'TEXT';
        }
        
        await pool.query(`
          ALTER TABLE paas_marketplace_templates 
          ADD COLUMN IF NOT EXISTS ${col} ${colDef}
        `);
        
        console.log(`✅ Added ${col}`);
      }
    }
    
    // Final verification
    const finalRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'paas_marketplace_templates'
      ORDER BY ordinal_position
    `);
    
    console.log('\n✅ Final schema:');
    console.log(finalRes.rows.map(r => r.column_name).join(', '));
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixMarketplaceTemplatesSchema();
