#!/usr/bin/env node

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createScriptPool } from './lib/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function applyMigration() {
  console.log('🚀 Applying vps_stackscript_configs migration...');
  
  const pool = createScriptPool();

  try {
    const client = await pool.connect();
    console.log('✅ Database connection successful!');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '006_vps_stackscript_configs.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Running migration SQL...');
    await client.query(migrationSQL);
    
    console.log('✅ Migration applied successfully!');
    
    // Verify the table was created
    const checkTable = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'vps_stackscript_configs'
      ) AS exists
    `);
    
    if (checkTable.rows[0].exists) {
      console.log('✅ Table vps_stackscript_configs verified!');
    } else {
      console.log('⚠️  Table verification failed');
    }
    
    client.release();
    await pool.end();
    
    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

applyMigration();
