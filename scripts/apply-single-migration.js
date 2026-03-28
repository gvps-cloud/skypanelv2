#!/usr/bin/env node

/**
 * Apply a single PostgreSQL migration file
 * Usage: node scripts/apply-single-migration.js migrations/007_networking_config.sql
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const { Pool } = pg;

async function applySingleMigration() {
  try {
    const migrationArg = process.argv[2];
    if (!migrationArg) {
      console.error('❌ Missing migration file path.');
      console.error('Usage: node scripts/apply-single-migration.js migrations/007_networking_config.sql');
      process.exit(1);
    }

    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL environment variable is not set!');
      console.log('Set it in .env, e.g.:');
      console.log('DATABASE_URL=postgresql://username:password@localhost:5432/your_db_name');
      process.exit(1);
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    console.log('🔌 Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Database connection successful!');

    const migrationPath = join(__dirname, '..', migrationArg);
    console.log(`📄 Reading migration file: ${migrationPath}`);
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('🚀 Applying migration...');
    try {
      await client.query(migrationSQL);
      console.log('✅ Migration applied successfully');
    } catch (err) {
      console.error('❌ Migration failed:', err.message);
      process.exit(1);
    } finally {
      client.release();
      await pool.end();
    }

    console.log('\n🎉 Done.');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

applySingleMigration();