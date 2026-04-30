#!/usr/bin/env node

/**
 * Backup Pricing Data Migration Script
 * This script updates existing VPS plans and instances with default backup configuration
 * for the flexible backup pricing feature.
 */

import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createScriptPool } from './lib/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

async function migrateBackupPricingData() {
  console.log('🚀 Starting Backup Pricing Data Migration...\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set!');
    process.exit(1);
  }

  const pool = createScriptPool();

  try {
    const client = await pool.connect();
    console.log('✅ Database connection successful!\n');

    // Start transaction
    await client.query('BEGIN');

    // Step 1: Check current state of VPS plans
    console.log('📊 Analyzing current VPS plans...');
    const plansStatsResult = await client.query(`
      SELECT 
        COUNT(*) as total_plans,
        COUNT(CASE WHEN weekly_backups_enabled IS NULL THEN 1 END) as plans_without_weekly_config,
        COUNT(CASE WHEN daily_backups_enabled IS NULL THEN 1 END) as plans_without_daily_config,
        COUNT(CASE WHEN backup_upcharge_monthly IS NULL THEN 1 END) as plans_without_upcharge
      FROM vps_plans
    `);

    const planStats = plansStatsResult.rows[0];
    console.log('\nVPS Plans current state:');
    console.log(`  Total plans: ${planStats.total_plans}`);
    console.log(`  Plans without weekly_backups_enabled: ${planStats.plans_without_weekly_config}`);
    console.log(`  Plans without daily_backups_enabled: ${planStats.plans_without_daily_config}`);
    console.log(`  Plans without backup_upcharge: ${planStats.plans_without_upcharge}`);

    // Step 2: Check current state of VPS instances
    console.log('\n📊 Analyzing current VPS instances...');
    const instancesStatsResult = await client.query(`
      SELECT 
        COUNT(*) as total_instances,
        COUNT(CASE WHEN backup_frequency IS NULL THEN 1 END) as instances_without_frequency,
        COUNT(CASE WHEN configuration::jsonb->>'backups_enabled' = 'true' THEN 1 END) as instances_with_backups_enabled,
        COUNT(CASE WHEN configuration::jsonb->>'backups_enabled' = 'false' OR configuration::jsonb->>'backups_enabled' IS NULL THEN 1 END) as instances_with_backups_disabled
      FROM vps_instances
    `);

    const instanceStats = instancesStatsResult.rows[0];
    console.log('\nVPS Instances current state:');
    console.log(`  Total instances: ${instanceStats.total_instances}`);
    console.log(`  Instances without backup_frequency: ${instanceStats.instances_without_frequency}`);
    console.log(`  Instances with backups enabled: ${instanceStats.instances_with_backups_enabled}`);
    console.log(`  Instances with backups disabled: ${instanceStats.instances_with_backups_disabled}`);

    // Step 3: Update VPS plans - Set weekly_backups_enabled = true for all existing plans
    console.log('\n🔄 Setting weekly_backups_enabled = true for all existing plans...');
    const weeklyBackupsResult = await client.query(`
      UPDATE vps_plans
      SET weekly_backups_enabled = true
      WHERE weekly_backups_enabled IS NULL
      RETURNING id, name
    `);

    console.log(`✅ Updated ${weeklyBackupsResult.rowCount} plans with weekly_backups_enabled = true`);
    if (weeklyBackupsResult.rowCount > 0 && weeklyBackupsResult.rowCount <= 10) {
      weeklyBackupsResult.rows.forEach(row => {
        console.log(`   - ${row.name} (${row.id})`);
      });
    }

    // Step 4: Get provider IDs for Linode
    console.log('\n🔍 Fetching Linode provider IDs...');
    const linodeProvidersResult = await client.query(`
      SELECT id, name
      FROM service_providers
      WHERE type = 'linode'
    `);

    console.log(`Found ${linodeProvidersResult.rowCount} Linode provider(s)`);
    linodeProvidersResult.rows.forEach(row => {
      console.log(`  - ${row.name} (${row.id})`);
    });

    // Step 5: Set daily_backups_enabled = false for Linode plans
    if (linodeProvidersResult.rowCount > 0) {
      console.log('\n🔄 Setting daily_backups_enabled = false for Linode plans...');
      const linodeProviderIds = linodeProvidersResult.rows.map(r => r.id);
      
      const dailyBackupsResult = await client.query(`
        UPDATE vps_plans
        SET daily_backups_enabled = false
        WHERE provider_id = ANY($1::uuid[])
          AND (daily_backups_enabled IS NULL OR daily_backups_enabled = true)
        RETURNING id, name
      `, [linodeProviderIds]);

      console.log(`✅ Updated ${dailyBackupsResult.rowCount} Linode plans with daily_backups_enabled = false`);
      if (dailyBackupsResult.rowCount > 0 && dailyBackupsResult.rowCount <= 10) {
        dailyBackupsResult.rows.forEach(row => {
          console.log(`   - ${row.name} (${row.id})`);
        });
      }
    } else {
      console.log('ℹ️  No Linode providers found, skipping daily_backups_enabled update');
    }

    // Step 6: Set backup_upcharge_monthly = 0 for all existing plans
    console.log('\n🔄 Setting backup_upcharge_monthly = 0 for all existing plans...');
    const upchargeResult = await client.query(`
      UPDATE vps_plans
      SET backup_upcharge_monthly = 0,
          backup_upcharge_hourly = 0
      WHERE backup_upcharge_monthly IS NULL
      RETURNING id, name
    `);

    console.log(`✅ Updated ${upchargeResult.rowCount} plans with backup_upcharge = 0`);
    if (upchargeResult.rowCount > 0 && upchargeResult.rowCount <= 10) {
      upchargeResult.rows.forEach(row => {
        console.log(`   - ${row.name} (${row.id})`);
      });
    }

    // Step 7: Update VPS instances with backup_frequency = 'weekly' where backups enabled
    console.log('\n🔄 Setting backup_frequency = \'weekly\' for instances with backups enabled...');
    const weeklyInstancesResult = await client.query(`
      UPDATE vps_instances
      SET backup_frequency = 'weekly'
      WHERE configuration::jsonb->>'backups_enabled' = 'true'
        AND (backup_frequency IS NULL OR backup_frequency = 'none')
      RETURNING id, label
    `);

    console.log(`✅ Updated ${weeklyInstancesResult.rowCount} instances with backup_frequency = 'weekly'`);
    if (weeklyInstancesResult.rowCount > 0 && weeklyInstancesResult.rowCount <= 10) {
      weeklyInstancesResult.rows.forEach(row => {
        console.log(`   - ${row.label} (${row.id})`);
      });
    }

    // Step 8: Update VPS instances with backup_frequency = 'none' where backups disabled
    console.log('\n🔄 Setting backup_frequency = \'none\' for instances with backups disabled...');
    const noneInstancesResult = await client.query(`
      UPDATE vps_instances
      SET backup_frequency = 'none'
      WHERE (configuration::jsonb->>'backups_enabled' = 'false' 
             OR configuration::jsonb->>'backups_enabled' IS NULL)
        AND (backup_frequency IS NULL OR backup_frequency = 'weekly')
      RETURNING id, label
    `);

    console.log(`✅ Updated ${noneInstancesResult.rowCount} instances with backup_frequency = 'none'`);
    if (noneInstancesResult.rowCount > 0 && noneInstancesResult.rowCount <= 10) {
      noneInstancesResult.rows.forEach(row => {
        console.log(`   - ${row.label} (${row.id})`);
      });
    }

    // Step 9: Verify data integrity
    console.log('\n🔍 Verifying data integrity...');
    
    // Check for plans without backup configuration
    const missingConfigResult = await client.query(`
      SELECT id, name, provider_id
      FROM vps_plans
      WHERE weekly_backups_enabled IS NULL 
         OR daily_backups_enabled IS NULL 
         OR backup_upcharge_monthly IS NULL
    `);

    if (missingConfigResult.rowCount > 0) {
      console.warn(`⚠️  Found ${missingConfigResult.rowCount} plans with incomplete backup configuration:`);
      missingConfigResult.rows.forEach(row => {
        console.log(`   - ${row.name} (${row.id})`);
      });
    } else {
      console.log('✅ All plans have complete backup configuration');
    }

    // Check for instances without backup_frequency
    const missingFrequencyResult = await client.query(`
      SELECT id, label, configuration
      FROM vps_instances
      WHERE backup_frequency IS NULL
    `);

    if (missingFrequencyResult.rowCount > 0) {
      console.warn(`⚠️  Found ${missingFrequencyResult.rowCount} instances without backup_frequency:`);
      missingFrequencyResult.rows.forEach(row => {
        console.log(`   - ${row.label} (${row.id})`);
      });
    } else {
      console.log('✅ All instances have backup_frequency set');
    }

    // Step 10: Final statistics
    console.log('\n📊 Final statistics:');
    
    // Plans by provider type
    const plansByProviderResult = await client.query(`
      SELECT 
        COALESCE(sp.name, 'Unknown') as provider_name,
        sp.type as provider_type,
        COUNT(*) as plan_count,
        COUNT(CASE WHEN vp.daily_backups_enabled = true THEN 1 END) as daily_enabled,
        COUNT(CASE WHEN vp.weekly_backups_enabled = true THEN 1 END) as weekly_enabled,
        AVG(vp.backup_upcharge_monthly) as avg_upcharge
      FROM vps_plans vp
      LEFT JOIN service_providers sp ON vp.provider_id = sp.id
      GROUP BY sp.name, sp.type
      ORDER BY provider_name
    `);

    console.log('\nPlans by provider:');
    plansByProviderResult.rows.forEach(row => {
      console.log(`  ${row.provider_name} (${row.provider_type || 'N/A'}):`);
      console.log(`    Total plans: ${row.plan_count}`);
      console.log(`    Daily backups enabled: ${row.daily_enabled}`);
      console.log(`    Weekly backups enabled: ${row.weekly_enabled}`);
      console.log(`    Average upcharge: $${parseFloat(row.avg_upcharge || 0).toFixed(2)}/mo`);
    });

    // Instances by backup frequency
    const instancesByFrequencyResult = await client.query(`
      SELECT 
        backup_frequency,
        COUNT(*) as count
      FROM vps_instances
      GROUP BY backup_frequency
      ORDER BY backup_frequency
    `);

    console.log('\nInstances by backup frequency:');
    instancesByFrequencyResult.rows.forEach(row => {
      console.log(`  ${row.backup_frequency || 'NULL'}: ${row.count} instances`);
    });

    // Commit transaction
    await client.query('COMMIT');
    console.log('\n✅ Transaction committed successfully!');

    client.release();
    console.log('\n🎉 Backup Pricing Data Migration completed!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
migrateBackupPricingData().catch(console.error);
