/**
 * Check admin users in the database
 */

import dotenv from 'dotenv';
import { createScriptPool } from './lib/database.js';

dotenv.config();

const pool = createScriptPool();

async function checkAdminUsers() {
  console.log('🔍 Checking for admin users...\n');

  try {
    // Check all users with their roles
    const result = await pool.query(
      'SELECT id, email, name, role FROM users ORDER BY role, email'
    );

    console.log('All users in database:');
    console.log('='.repeat(80));
    result.rows.forEach(user => {
      console.log(`${user.role === 'admin' ? '👑' : '👤'} ${user.email} (${user.role}) - ${user.name || 'No name'}`);
    });
    console.log('='.repeat(80));

    const adminUsers = result.rows.filter(u => u.role === 'admin');
    console.log(`\nFound ${adminUsers.length} admin user(s)`);

    if (adminUsers.length === 0) {
      console.log('\n⚠️  No admin users found!');
      console.log('   You can promote john@example.com to admin by running:');
      console.log('   node scripts/promote-to-admin.js');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAdminUsers();
