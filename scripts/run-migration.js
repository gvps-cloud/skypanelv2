#!/usr/bin/env node

/**
 * Migration Runner for SkyPanelV2 PostgreSQL
 * Runs pending migrations and records them in schema_migrations tracking table.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const { Pool } = pg;

const BOOTSTRAP_SQL = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        execution_time_ms INTEGER
    );
`;

function checksum(contents) {
    return createHash('sha256').update(contents).digest('hex');
}

async function ensureTrackingTable(pool) {
    await pool.query(BOOTSTRAP_SQL);
}

async function getAppliedMigrations(pool) {
    const result = await pool.query('SELECT filename, checksum FROM schema_migrations ORDER BY filename');
    const map = new Map();
    for (const row of result.rows) {
        map.set(row.filename, row.checksum);
    }
    return map;
}

async function runMigration() {
    console.log('🚀 Starting SkyPanelV2 PostgreSQL Migration...\n');

    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL environment variable is not set!');
        console.log('Please set your PostgreSQL connection string in the .env file:');
        console.log('DATABASE_URL=postgresql://username:password@localhost:5432/your_db_name');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('🔌 Testing database connection...');
        const client = await pool.connect();
        console.log('✅ Database connection successful!');
        client.release();

        // Bootstrap tracking table
        await ensureTrackingTable(pool);

        // Read migration files
        const migrationsDir = join(__dirname, '..', 'migrations');
        const files = readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        // Get already-applied migrations
        const applied = await getAppliedMigrations(pool);

        // Filter to pending only
        const pending = files.filter(f => !applied.has(f));
        const alreadyApplied = files.filter(f => applied.has(f));

        if (alreadyApplied.length > 0) {
            console.log(`⏭️  Skipping ${alreadyApplied.length} already-applied migration(s)`);
        }

        if (pending.length === 0) {
            console.log('✅ No pending migrations. Database is up to date.');
            return;
        }

        console.log(`📄 Found ${pending.length} pending migration(s): ${pending.join(', ')}\n`);

        let appliedCount = 0;
        for (const file of pending) {
            const migrationPath = join(migrationsDir, file);
            const migrationSQL = readFileSync(migrationPath, 'utf8');
            const fileChecksum = checksum(migrationSQL);

            // Checksum validation for existing tracked migrations (safety net)
            if (applied.has(file) && applied.get(file) !== fileChecksum) {
                console.log(`⚠️  Migration ${file}: checksum mismatch (file may have changed after apply). Skipping.`);
                continue;
            }

            process.stdout.write(`🔄 Running migration ${file}... `);
            const start = Date.now();
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                await client.query(migrationSQL);
                await client.query(
                    'INSERT INTO schema_migrations (filename, checksum, execution_time_ms) VALUES ($1, $2, $3) ON CONFLICT (filename) DO NOTHING',
                    [file, fileChecksum, Date.now() - start]
                );
                await client.query('COMMIT');
                console.log(`✅ (${Date.now() - start}ms)`);
                appliedCount++;
            } catch (err) {
                await client.query('ROLLBACK');
                const msg = (err?.message || '').toLowerCase();
                if (
                    msg.includes('already exists') ||
                    msg.includes('duplicate')
                ) {
                    // Legacy compatibility: migration was already applied before tracking existed.
                    // Record it and continue.
                    await pool.query(
                        'INSERT INTO schema_migrations (filename, checksum, execution_time_ms) VALUES ($1, $2, $3) ON CONFLICT (filename) DO NOTHING',
                        [file, fileChecksum, Date.now() - start]
                    );
                    console.log(`ℹ️  (already applied, recorded in tracking)`);
                    appliedCount++;
                } else {
                    console.error('❌');
                    console.error(`   Migration failed: ${err.message}`);
                    process.exit(1);
                }
            } finally {
                client.release();
            }
        }

        // Verify tables
        console.log('\n🔍 Verifying tables...');
        const tablesResult = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);

        console.log('📊 Tables:');
        tablesResult.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });

        // Check if admin user was created
        const adminResult = await pool.query(
            "SELECT email, name, role FROM users WHERE email = 'admin@example.com'"
        );

        if (adminResult.rows.length > 0) {
            console.log('\n👤 Default admin user:');
            console.log(`  Email: ${adminResult.rows[0].email}`);
            console.log(`  Name: ${adminResult.rows[0].name}`);
            console.log(`  Role: ${adminResult.rows[0].role}`);
        }

        console.log(`\n🎉 Migration complete. ${appliedCount} migration(s) applied.`);

    } catch (error) {
        console.error('❌ Migration failed:', error.message);

        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Connection refused. Please ensure:');
            console.log('  1. PostgreSQL is running');
            console.log('  2. Database exists');
            console.log('  3. Connection string is correct');
        } else if (error.code === '28P01') {
            console.log('\n💡 Authentication failed. Please check:');
            console.log('  1. Username and password are correct');
            console.log('  2. User has permission to access the database');
        }

        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run the migration
runMigration().catch(console.error);
