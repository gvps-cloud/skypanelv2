#!/usr/bin/env node

/**
 * Ensure PaaS storage is properly configured
 * This script initializes default PaaS storage settings and ensures directories exist
 */

import { pool } from '../api/lib/database.js';
import { ensureDirectory } from '../api/lib/fsUtils.js';
import fs from 'fs/promises';
import path from 'path';

const DEFAULT_STORAGE_SETTINGS = {
  storage_type: 'local',
  local_storage_path: '/var/paas/storage',
  buildpack_cache_enabled: true,
  buildpack_cache_max_size_mb: 500,
  buildpack_cache_ttl_hours: 24,
};

async function ensureStorageDirectories() {
  const storagePath = DEFAULT_STORAGE_SETTINGS.local_storage_path;
  const subdirs = [
    'builds',
    'build-cache',
    'slugs',
    'temp',
    'logs',
  ];

  console.log('📁 Creating storage directories...');

  try {
    // Main storage directory
    await ensureDirectory(storagePath);
    console.log(`✅ Storage directory: ${storagePath}`);

    // Subdirectories
    for (const subdir of subdirs) {
      const fullPath = path.join(storagePath, subdir);
      await ensureDirectory(fullPath);
      console.log(`✅ Subdirectory: ${fullPath}`);
    }
  } catch (error) {
    console.error('❌ Failed to create storage directories:', error.message);
    throw error;
  }
}

async function initializeStorageSettings() {
  console.log('⚙️  Initializing PaaS storage settings...');

  try {
    // Check if settings already exist
    const existingResult = await pool.query(
      'SELECT key FROM paas_settings WHERE key IN ($1, $2, $3, $4, $5)',
      [
        'storage_type',
        'local_storage_path',
        'buildpack_cache_enabled',
        'buildpack_cache_max_size_mb',
        'buildpack_cache_ttl_hours'
      ]
    );

    const existingKeys = new Set(existingResult.rows.map(row => row.key));

    // Insert missing settings
    for (const [key, value] of Object.entries(DEFAULT_STORAGE_SETTINGS)) {
      if (!existingKeys.has(key)) {
        await pool.query(
          `INSERT INTO paas_settings (key, value, category, description, created_at, updated_at)
           VALUES ($1, $2, 'storage', $3, NOW(), NOW())`,
          [
            key,
            typeof value === 'boolean' ? value : String(value),
            `Default ${key.replace(/_/g, ' ')}`
          ]
        );
        console.log(`✅ Setting initialized: ${key} = ${value}`);
      } else {
        console.log(`ℹ️  Setting already exists: ${key}`);
      }
    }
  } catch (error) {
    console.error('❌ Failed to initialize storage settings:', error.message);
    throw error;
  }
}

async function verifyStorageAccess() {
  console.log('🔍 Verifying storage access...');

  const storagePath = DEFAULT_STORAGE_SETTINGS.local_storage_path;

  try {
    // Test write access
    const testFile = path.join(storagePath, '.access-test');
    await fs.writeFile(testFile, 'test');
    await fs.unlink(testFile);
    console.log('✅ Storage directory is writable');
  } catch (error) {
    console.error('❌ Storage directory is not writable:', error.message);
    console.log('💡 Tip: Ensure the process has write permissions to', storagePath);
    throw error;
  }
}

async function main() {
  console.log('🚀 Ensuring PaaS storage configuration...\n');

  try {
    await ensureStorageDirectories();
    console.log();

    await initializeStorageSettings();
    console.log();

    await verifyStorageAccess();
    console.log();

    console.log('✅ PaaS storage configuration completed successfully!');
  } catch (error) {
    console.error('\n❌ PaaS storage configuration failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ensureStorageDirectories, initializeStorageSettings, verifyStorageAccess };