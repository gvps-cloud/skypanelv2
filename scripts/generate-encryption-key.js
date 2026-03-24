#!/usr/bin/env node
/**
 * Generate ENCRYPTION_KEY and add it to .env file
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env');

// Generate a secure 32-byte key for AES-256 encryption
const key = crypto.randomBytes(32).toString('hex');

console.log('🔑 Generated ENCRYPTION_KEY:', key);

try {
  // Check if .env exists
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found!');
    console.log('   Create a .env file first, then run this script again.');
    process.exit(1);
  }

  // Read existing .env
  let envContent = fs.readFileSync(envPath, 'utf8');

  // Check if ENCRYPTION_KEY already exists
  if (envContent.includes('ENCRYPTION_KEY=')) {
    console.log('⚠️  ENCRYPTION_KEY already exists in .env');
    console.log('   Do you want to replace it? This will break any existing encrypted provider tokens!');
    console.log('   To replace, manually edit .env or delete the existing ENCRYPTION_KEY line and run this script again.');
    process.exit(0);
  }

  // Add ENCRYPTION_KEY to .env
  if (!envContent.endsWith('\n')) {
    envContent += '\n';
  }
  envContent += `\n# Encryption Key for Provider API Tokens (AES-256)\nENCRYPTION_KEY=${key}\n`;

  fs.writeFileSync(envPath, envContent);
  console.log('✅ Added ENCRYPTION_KEY to .env file');
  console.log('\n📝 Next steps:');
  console.log('   1. Restart your dev server');
  console.log('   2. If you have existing provider tokens, they will need to be re-saved');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
