import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function createTestAdmin() {
  console.log('🔐 Creating test admin user...\n');

  try {
    // Parse command line arguments - handle both --flag=value and --flag value formats
    const args = process.argv.slice(2);
    let email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
    let password = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin123#';

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // Handle --email=value format
      if (arg.startsWith('--email=')) {
        email = arg.substring('--email='.length);
      }
      // Handle --password=value format
      else if (arg.startsWith('--password=')) {
        password = arg.substring('--password='.length);
      }
      // Handle --email value format
      else if (arg === '--email' && args[i + 1]) {
        email = args[i + 1];
        i++;
      }
      // Handle --password value format
      else if (arg === '--password' && args[i + 1]) {
        password = args[i + 1];
        i++;
      }
    }

    console.log(`📧 Email: ${email}`);
    // SECURITY: Never log passwords - only show masked placeholder
    console.log('🔑 Password: [hidden]\n');
    // Log that password was provided via CLI without revealing it
    const passwordSource = args.some(a => a.includes('--password')) ? 'CLI argument' : 'environment/default';
    console.log(`   (Password provided via ${passwordSource})\n`);

    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      console.log('✅ Admin user already exists');
      console.log(`   Email: ${existingUser.rows[0].email}`);
      console.log(`   Role: ${existingUser.rows[0].role}`);

      const userId = existingUser.rows[0].id;

      // Update password and ensure admin role
      await pool.query(
        'UPDATE users SET password_hash = $1, role = $2 WHERE email = $3',
        [hashedPassword, 'admin', email]
      );
      console.log('✅ Password updated');
      console.log('✅ Role set to: admin');

      // Check if user has an organization
      const orgMembership = await pool.query(
        `SELECT om.organization_id, o.name 
         FROM organization_members om 
         JOIN organizations o ON om.organization_id = o.id 
         WHERE om.user_id = $1`,
        [userId]
      );

      if (orgMembership.rows.length === 0) {
        console.log('🏢 Creating organization for admin user...');

        // Create organization for the admin user
        const orgResult = await pool.query(
          `INSERT INTO organizations (name, slug, owner_id)
           VALUES ($1, $2, $3)
           RETURNING id, name`,
          ['Admin Organization', 'admin-org', userId]
        );

        const orgId = orgResult.rows[0].id;

        // Add admin user to organization members
        await pool.query(
          `INSERT INTO organization_members (organization_id, user_id, role)
           VALUES ($1, $2, $3)`,
          [orgId, userId, 'owner']
        );

        // Create wallet for the organization
        await pool.query(
          `INSERT INTO wallets (organization_id, balance)
           VALUES ($1, $2)`,
          [orgId, 0.00]
        );

        console.log(`✅ Organization created: ${orgResult.rows[0].name}`);
      } else {
        console.log(`✅ Organization: ${orgMembership.rows[0].name}`);
      }
      console.log('');
    } else {
      // Create new admin user
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, role, name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, role`,
        [email, hashedPassword, 'admin', 'Admin User']
      );

      const userId = result.rows[0].id;

      // Create organization for the admin user
      const orgResult = await pool.query(
        `INSERT INTO organizations (name, slug, owner_id)
         VALUES ($1, $2, $3)
         RETURNING id, name`,
        ['Admin Organization', 'admin-org', userId]
      );

      const orgId = orgResult.rows[0].id;

      // Add admin user to organization members
      await pool.query(
        `INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, $3)`,
        [orgId, userId, 'owner']
      );

      // Create wallet for the organization
      await pool.query(
        `INSERT INTO wallets (organization_id, balance)
         VALUES ($1, $2)`,
        [orgId, 0.00]
      );

      console.log('✅ Admin user created successfully');
      console.log(`   Email: ${result.rows[0].email}`);
      console.log(`   Role: ${result.rows[0].role}`);
      console.log(`   Organization: ${orgResult.rows[0].name}`);
      console.log('   Password: [hidden]\n');
    }

  } catch (error) {
    // Sanitize error output to prevent password leakage
    const sanitizedError = error.message.includes(password)
      ? error.message.replace(password, '[REDACTED]')
      : error.message;
    console.error('❌ Error creating admin user:', sanitizedError);
  } finally {
    await pool.end();
  }
}

createTestAdmin();
