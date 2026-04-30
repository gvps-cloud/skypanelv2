#!/usr/bin/env node
/**
 * Database Reset Script
 * 
 * WARNING: This script will DROP ALL TABLES and DATA from the database.
 * Use only in development environments!
 * 
 * Usage:
 *   node scripts/reset-database.js
 *   node scripts/reset-database.js --confirm
 */

import pg from 'pg';
import dotenv from 'dotenv';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

// Parse command line arguments
const args = process.argv.slice(2);
const autoConfirm = args.includes('--confirm');

async function resetDatabase() {
    const DATABASE_URL = process.env.DATABASE_URL;

    if (!DATABASE_URL) {
        console.error('❌ DATABASE_URL environment variable is not set');
        console.error('   Please check your .env file');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: DATABASE_URL,
    });

    try {
        console.log('🔌 Connecting to database...');
        const client = await pool.connect();

        try {
            console.log('✅ Connected to database');
            console.log('');

            // Get confirmation from user
            if (!autoConfirm) {
                const confirmed = await askForConfirmation();
                if (!confirmed) {
                    console.log('❌ Database reset cancelled');
                    return;
                }
            }

            console.log('🗑️  Starting database cleanup...');
            console.log('');

            // Drop all tables in the public schema
            console.log('📋 Fetching all tables...');
            const tablesResult = await client.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename
      `);

            if (tablesResult.rows.length === 0) {
                console.log('ℹ️  No tables found in database');
            } else {
                console.log(`Found ${tablesResult.rows.length} tables:`);
                tablesResult.rows.forEach(row => {
                    console.log(`  - ${row.tablename}`);
                });
                console.log('');

                // Drop all tables with CASCADE
                console.log('🔥 Dropping all tables...');
                for (const row of tablesResult.rows) {
                    const tableName = row.tablename;
                    console.log(`  Dropping table: ${tableName}`);
                    await client.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
                }
                console.log('✅ All tables dropped');
                console.log('');
            }

            // Drop all sequences
            console.log('📋 Fetching all sequences...');
            const sequencesResult = await client.query(`
        SELECT sequencename 
        FROM pg_sequences 
        WHERE schemaname = 'public'
        ORDER BY sequencename
      `);

            if (sequencesResult.rows.length > 0) {
                console.log(`Found ${sequencesResult.rows.length} sequences:`);
                sequencesResult.rows.forEach(row => {
                    console.log(`  - ${row.sequencename}`);
                });
                console.log('');

                console.log('🔥 Dropping all sequences...');
                for (const row of sequencesResult.rows) {
                    const sequenceName = row.sequencename;
                    console.log(`  Dropping sequence: ${sequenceName}`);
                    await client.query(`DROP SEQUENCE IF EXISTS "${sequenceName}" CASCADE`);
                }
                console.log('✅ All sequences dropped');
                console.log('');
            }

            // Drop all views
            console.log('📋 Fetching all views...');
            const viewsResult = await client.query(`
        SELECT viewname 
        FROM pg_views 
        WHERE schemaname = 'public'
        ORDER BY viewname
      `);

            if (viewsResult.rows.length > 0) {
                console.log(`Found ${viewsResult.rows.length} views:`);
                viewsResult.rows.forEach(row => {
                    console.log(`  - ${row.viewname}`);
                });
                console.log('');

                console.log('🔥 Dropping all views...');
                for (const row of viewsResult.rows) {
                    const viewName = row.viewname;
                    console.log(`  Dropping view: ${viewName}`);
                    await client.query(`DROP VIEW IF EXISTS "${viewName}" CASCADE`);
                }
                console.log('✅ All views dropped');
                console.log('');
            }

            // Drop all functions (excluding extension functions)
            console.log('📋 Fetching all custom functions...');
            const functionsResult = await client.query(`
        SELECT 
          n.nspname as schema,
          p.proname as name,
          pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
        WHERE n.nspname = 'public'
          AND d.objid IS NULL
        ORDER BY p.proname
      `);

            if (functionsResult.rows.length > 0) {
                console.log(`Found ${functionsResult.rows.length} custom functions:`);
                functionsResult.rows.forEach(row => {
                    console.log(`  - ${row.name}(${row.args})`);
                });
                console.log('');

                console.log('🔥 Dropping all custom functions...');
                for (const row of functionsResult.rows) {
                    const functionSignature = `${row.name}(${row.args})`;
                    console.log(`  Dropping function: ${functionSignature}`);
                    await client.query(`DROP FUNCTION IF EXISTS "${row.name}"(${row.args}) CASCADE`);
                }
                console.log('✅ All custom functions dropped');
                console.log('');
            } else {
                console.log('ℹ️  No custom functions found');
                console.log('');
            }

            // Drop all types (enums, composite types, etc.)
            console.log('📋 Fetching all custom types...');
            const typesResult = await client.query(`
        SELECT 
          t.typname as name
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public'
          AND t.typtype IN ('e', 'c')
        ORDER BY t.typname
      `);

            if (typesResult.rows.length > 0) {
                console.log(`Found ${typesResult.rows.length} custom types:`);
                typesResult.rows.forEach(row => {
                    console.log(`  - ${row.name}`);
                });
                console.log('');

                console.log('🔥 Dropping all custom types...');
                for (const row of typesResult.rows) {
                    const typeName = row.name;
                    console.log(`  Dropping type: ${typeName}`);
                    await client.query(`DROP TYPE IF EXISTS "${typeName}" CASCADE`);
                }
                console.log('✅ All custom types dropped');
                console.log('');
            }

            console.log('✨ Database reset complete!');
            console.log('');
            console.log('💡 Next steps:');
            console.log('   1. Run migrations: node scripts/run-migration.js');
            console.log('   2. Create admin user: node scripts/create-test-admin.js --email admin@example.com --password admin123');
            console.log('');

        } finally {
            client.release();
        }
    } catch (error) {
        console.error('❌ Error resetting database:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

function askForConfirmation() {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log('⚠️  WARNING: This will DELETE ALL DATA from the database!');
        console.log('⚠️  This action cannot be undone!');
        console.log('');
        const dbUrl = process.env.DATABASE_URL || '';
        const dbInfo = dbUrl.includes('@') ? dbUrl.split('@')[1] : 'unknown';
        console.log(`Database: ${dbInfo}`);
        console.log('');

        rl.question('Are you sure you want to continue? Type "yes" to confirm: ', (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes');
        });
    });
}

// Run the script
resetDatabase().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
