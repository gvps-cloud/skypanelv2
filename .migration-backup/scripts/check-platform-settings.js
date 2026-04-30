#!/usr/bin/env node

import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createScriptPool } from './lib/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

async function checkTable() {
  const pool = createScriptPool();

  try {
    // Check columns in platform_settings
    const columnsQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'platform_settings'
      ORDER BY ordinal_position
    `;
    
    const result = await pool.query(columnsQuery);
    console.log('Columns in platform_settings:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
    });

    // Check data
    const dataQuery = 'SELECT * FROM platform_settings';
    const dataResult = await pool.query(dataQuery);
    console.log('\nData in platform_settings:');
    console.log(JSON.stringify(dataResult.rows, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTable().catch(console.error);
