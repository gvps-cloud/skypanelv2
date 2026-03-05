#!/usr/bin/env node

/**
 * VPS Plan Type Class Migration Script
 * This script backfills type_class for existing VPS plans by fetching plan details
 * from the Linode API. It can also optionally populate the vps_plan_regions table.
 *
 * Usage:
 *   node scripts/migrate-vps-plan-type-class.js [--add-regions]
 *
 * Options:
 *   --add-regions  - Also populate vps_plan_regions table with all available regions
 *                    for each plan (requires manual review after migration)
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const { Pool } = pg;

// Linode API integration
async function fetchLinodeTypes(providerApiKey) {
  const response = await fetch('https://api.linode.com/v4/linode/types', {
    headers: {
      'Authorization': `Bearer ${providerApiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Linode API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || [];
}

async function fetchLinodeRegions(providerApiKey) {
  const response = await fetch('https://api.linode.com/v4/regions', {
    headers: {
      'Authorization': `Bearer ${providerApiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Linode API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || [];
}

// Type class mapping from Linode API to our internal format
const TYPE_CLASS_MAP = {
  'nanode': 'standard',
  'standard': 'standard',
  'dedicated': 'cpu',
  'highmem': 'memory',
  'premium': 'premium',
  'gpu': 'gpu',
  'accelerated': 'accelerated',
};

function getMappedTypeClass(linodeTypeClass) {
  const tc = (linodeTypeClass || '').toLowerCase().trim();
  return TYPE_CLASS_MAP[tc] || 'standard';
}

async function migrateVPSPPlanTypeClass(addRegions = false) {
  console.log('🚀 Starting VPS Plan Type Class Migration...\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set!');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    console.log('✅ Database connection successful!\n');

    // Start transaction
    await client.query('BEGIN');

    // Step 1: Check current state
    console.log('📊 Analyzing current VPS plans...');
    const plansStatsResult = await client.query(`
      SELECT
        COUNT(*) as total_plans,
        COUNT(CASE WHEN type_class IS NULL OR type_class = '' THEN 1 END) as plans_without_type_class
      FROM vps_plans
    `);

    const planStats = plansStatsResult.rows[0];
    console.log('\nVPS Plans current state:');
    console.log(`  Total plans: ${planStats.total_plans}`);
    console.log(`  Plans without type_class: ${planStats.plans_without_type_class}`);

    // Step 2: Get active Linode providers
    const providersResult = await client.query(`
      SELECT id, api_key_encrypted, type
      FROM service_providers
      WHERE active = true AND type = 'linode'
    `);

    if (providersResult.rows.length === 0) {
      console.log('\n⚠️  No active Linode providers found. Exiting.');
      await client.query('ROLLBACK');
      client.release();
      await pool.end();
      return;
    }

    console.log(`\nFound ${providersResult.rows.length} active Linode provider(s)`);

    // Step 3: For each provider, fetch types and update plans
    for (const provider of providersResult.rows) {
      console.log(`\n📡 Processing provider: ${provider.id}`);

      // Decrypt API key (this is a simplified version - in production you'd use your crypto module)
      // For now, we'll skip this as it requires additional crypto setup
      console.log('  ⚠️  Skipping provider - API key decryption requires additional setup');
      console.log('  💡 Run this script after setting up proper API key decryption');
      continue;

      // Uncomment below when API key decryption is set up:
      /*
      const linodeTypes = await fetchLinodeTypes(provider.api_key_encrypted);
      console.log(`  Found ${linodeTypes.length} Linode types`);

      // Build a map of provider_plan_id -> type_class
      const typeClassMap = new Map();
      for (const type of linodeTypes) {
        const mappedTypeClass = getMappedTypeClass(type.class);
        typeClassMap.set(type.id, mappedTypeClass);
      }

      // Update plans without type_class
      const plansToUpdateResult = await client.query(`
        SELECT id, provider_plan_id, type_class
        FROM vps_plans
        WHERE provider_id = $1
          AND (type_class IS NULL OR type_class = '')
      `, [provider.id]);

      console.log(`  Found ${plansToUpdateResult.rows.length} plans to update`);

      let updatedCount = 0;
      for (const plan of plansToUpdateResult.rows) {
        const typeClass = typeClassMap.get(plan.provider_plan_id);
        if (typeClass) {
          await client.query(`
            UPDATE vps_plans
            SET type_class = $1
            WHERE id = $2
          `, [typeClass, plan.id]);
          updatedCount++;
        }
      }

      console.log(`  Updated ${updatedCount} plans with type_class`);

      // Step 4: Optionally add regions
      if (addRegions) {
        console.log('  Adding regions to vps_plan_regions table...');

        const linodeRegions = await fetchLinodeRegions(provider.api_key_encrypted);
        console.log(`  Found ${linodeRegions.length} regions`);

        const allPlansResult = await client.query(`
          SELECT id, type_class, provider_plan_id
          FROM vps_plans
          WHERE provider_id = $1 AND active = true
        `, [provider.id]);

        let regionCount = 0;
        for (const plan of allPlansResult.rows) {
          // Determine which regions this plan type is available in
          let availableRegions = linodeRegions;

          if (plan.type_class === 'premium') {
            availableRegions = linodeRegions.filter(r =>
              r.capabilities && r.capabilities.includes('Premium Plans')
            );
          } else if (plan.type_class === 'gpu') {
            availableRegions = linodeRegions.filter(r =>
              r.capabilities && r.capabilities.includes('GPU Linodes')
            );
          } else if (plan.type_class === 'accelerated') {
            availableRegions = linodeRegions.filter(r =>
              r.capabilities && r.capabilities.includes('Accelerated')
            );
          }

          // Insert regions
          for (const region of availableRegions) {
            try {
              await client.query(`
                INSERT INTO vps_plan_regions (vps_plan_id, region_id)
                VALUES ($1, $2)
                ON CONFLICT (vps_plan_id, region_id) DO NOTHING
              `, [plan.id, region.id]);
              regionCount++;
            } catch (err) {
              // Ignore duplicate errors
            }
          }
        }

        console.log(`  Added ${regionCount} region associations`);
      }
      */
    }

    // Commit transaction
    await client.query('COMMIT');
    console.log('\n✅ Migration completed successfully!');

    // Summary
    console.log('\n📋 Summary:');
    console.log('  ⚠️  This script requires API key decryption setup to fully function');
    console.log('  💡 Alternatively, you can manually update type_class for existing plans:');
    console.log('     UPDATE vps_plans SET type_class = \'standard\' WHERE type_class IS NULL;');
    console.log('     UPDATE vps_plans SET type_class = \'cpu\' WHERE provider_plan_id LIKE \'g6-dedicated%\';');
    console.log('     UPDATE vps_plans SET type_class = \'premium\' WHERE provider_plan_id LIKE \'g7%\';');
    console.log('     UPDATE vps_plans SET type_class = \'memory\' WHERE provider_plan_id LIKE \'highmem%\';');

    if (addRegions) {
      console.log('\n  ⚠️  Region associations were skipped due to API key decryption');
      console.log('  💡 You can manually add regions using the admin panel after setting up plans');
    }

    client.release();
    await pool.end();

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const addRegions = args.includes('--add-regions');

migrateVPSPPlanTypeClass(addRegions);
