#!/usr/bin/env node

/**
 * verify-env.js — Production environment variable validation script
 *
 * Reads .env (or .env.production) and validates all required/optional
 * variables are present, non-placeholder, and meet minimum length requirements.
 *
 * Usage:
 *   node scripts/verify-env.js                 # validate current .env
 *   node scripts/verify-env.js .env.production # validate a specific file
 *
 * Exit codes:
 *   0 — all checks pass (warnings may still be present)
 *   1 — critical errors found (missing required vars, placeholder values)
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ── Helpers ────────────────────────────────────────────────────────────────

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

function fail(msg) { console.error(`${RED}✗${RESET} ${msg}`); }
function warn(msg) { console.warn(`${YELLOW}⚠${RESET} ${msg}`); }
function pass(msg) { console.log(`${GREEN}✓${RESET} ${msg}`); }

// ── Parse .env file ────────────────────────────────────────────────────────

function parseEnvFile(filePath) {
  const abs = resolve(filePath);
  if (!existsSync(abs)) return null;

  const contents = readFileSync(abs, 'utf8');
  const env = {};

  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();

    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }

    env[key] = val;
  }

  return env;
}

// ── Variable definitions ───────────────────────────────────────────────────

const REQUIRED_ALWAYS = [
  { key: 'DATABASE_URL', minLen: 10 },
  { key: 'JWT_SECRET', minLen: 32, noPlaceholder: 'your-super-secret-jwt-key' },
  { key: 'SSH_CRED_SECRET', minLen: 32, noPlaceholder: 'your-32-character-encryption-key' },
  { key: 'ENCRYPTION_KEY', minLen: 32, noPlaceholder: 'your-32-character-encryption-key' },
];

const REQUIRED_PRODUCTION = [
  { key: 'LINODE_API_TOKEN', minLen: 40, noPlaceholder: 'your-linode-api-token' },
  { key: 'PAYPAL_CLIENT_ID', minLen: 10, noPlaceholder: 'your-paypal-client-id' },
  { key: 'PAYPAL_CLIENT_SECRET', minLen: 20, noPlaceholder: 'your-paypal-client-secret' },
  { key: 'PAYPAL_MODE', allowed: ['live', 'sandbox'] },
  { key: 'CLIENT_URL', minLen: 10 },
  { key: 'RDNS_BASE_DOMAIN', minLen: 4, noPlaceholder: 'ip.rev.example.com' },
];

const RECOMMENDED = [
  { key: 'RESEND_API_KEY', minLen: 10 },
  { key: 'SMTP_HOST', minLen: 4 },
  { key: 'SMTP_USERNAME', minLen: 1 },
  { key: 'SMTP_PASSWORD', minLen: 1 },
  { key: 'FROM_EMAIL', minLen: 5 },
  { key: 'CONTACT_FORM_RECIPIENT', minLen: 5 },
  { key: 'REDIS_URL', minLen: 10 },
  { key: 'TRUST_PROXY', allowed: ['true', 'false', '1', '2', 'loopback'] },
];

const PLACEHOLDERS = [
  'your-super-secret', 'your-32-character', 'change-in-production',
  'your-linode-api-token', 'your-paypal-client', 'example.com',
  'super-secure-password', 'your-domain',
];

function isPlaceholder(val) {
  if (!val) return false;
  const lower = val.toLowerCase();
  return PLACEHOLDERS.some(p => lower.includes(p));
}

// ── Validation ─────────────────────────────────────────────────────────────

function validateVars(env, isProduction) {
  let errors = 0;
  let warnings = 0;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Environment Validation — ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`${'='.repeat(60)}\n`);

  // Required always
  console.log('── Required (always) ──────────────────────────────────');
  for (const def of REQUIRED_ALWAYS) {
    const val = env[def.key];
    if (!val || val.length === 0) {
      fail(`${def.key} is not set`);
      errors++;
    } else if (def.noPlaceholder && val.toLowerCase().includes(def.noPlaceholder)) {
      fail(`${def.key} contains placeholder value`);
      errors++;
    } else if (isPlaceholder(val)) {
      fail(`${def.key} appears to contain a placeholder value`);
      errors++;
    } else if (val.length < def.minLen) {
      fail(`${def.key} is too short (${val.length}/${def.minLen} chars)`);
      errors++;
    } else {
      pass(`${def.key} (${val.length} chars)`);
    }
  }

  // Required in production
  console.log('\n── Required (production only) ─────────────────────────');
  for (const def of REQUIRED_PRODUCTION) {
    const val = env[def.key];
    if (!val || val.length === 0) {
      if (isProduction) {
        fail(`${def.key} is not set (required in production)`);
        errors++;
      } else {
        warn(`${def.key} is not set (required in production)`);
        warnings++;
      }
    } else if (def.noPlaceholder && val.toLowerCase().includes(def.noPlaceholder)) {
      if (isProduction) {
        fail(`${def.key} contains placeholder value`);
        errors++;
      } else {
        warn(`${def.key} contains placeholder value`);
        warnings++;
      }
    } else if (isPlaceholder(val)) {
      if (isProduction) {
        fail(`${def.key} appears to contain a placeholder value`);
        errors++;
      } else {
        warn(`${def.key} appears to contain a placeholder value`);
        warnings++;
      }
    } else if (def.allowed && !def.allowed.includes(val)) {
      fail(`${def.key}="${val}" — expected one of: ${def.allowed.join(', ')}`);
      errors++;
    } else if (val.length < def.minLen) {
      if (isProduction) {
        fail(`${def.key} is too short (${val.length}/${def.minLen} chars)`);
        errors++;
      } else {
        warn(`${def.key} is too short (${val.length}/${def.minLen} chars)`);
        warnings++;
      }
    } else {
      pass(`${def.key}=${def.allowed ? val : `(${val.length} chars)`}`);
    }
  }

  // Recommended
  console.log('\n── Recommended ───────────────────────────────────────');
  for (const def of RECOMMENDED) {
    const val = env[def.key];
    if (!val || val.length === 0) {
      warn(`${def.key} is not set (recommended)`);
      warnings++;
    } else if (def.allowed && !def.allowed.includes(val)) {
      warn(`${def.key}="${val}" — expected one of: ${def.allowed.join(', ')}`);
      warnings++;
    } else if (isPlaceholder(val)) {
      warn(`${def.key} appears to contain a placeholder value`);
      warnings++;
    } else {
      pass(`${def.key}=${def.allowed ? val : 'set'}`);
    }
  }

  // Security-specific checks
  console.log('\n── Security Checks ────────────────────────────────────');

  if (env.JWT_EXPIRES_IN) {
    const days = parseInt(env.JWT_EXPIRES_IN, 10);
    if (!isNaN(days) && days > 30) {
      warn(`JWT_EXPIRES_IN=${env.JWT_EXPIRES_IN} — consider shortening to ≤30d`);
      warnings++;
    } else {
      pass(`JWT_EXPIRES_IN=${env.JWT_EXPIRES_IN}`);
    }
  }

  if (env.AUTO_CREATE_ORG === 'true' && isProduction) {
    fail('AUTO_CREATE_ORG=true in production — should be false');
    errors++;
  } else if (env.AUTO_CREATE_ORG !== 'true') {
    pass('AUTO_CREATE_ORG is not true');
  }

  if (env.NODE_ENV === 'production') {
    pass('NODE_ENV=production');
  } else if (isProduction) {
    fail('NODE_ENV is not set to "production"');
    errors++;
  } else {
    warn('NODE_ENV is not set to "production" (expected in dev)');
    warnings++;
  }

  if (env.CSRF_ENFORCE === 'false' && isProduction) {
    fail('CSRF_ENFORCE=false in production — CSRF protection must be enabled');
    errors++;
  } else if (env.CSRF_ENFORCE !== 'false') {
    pass('CSRF enforcement is enabled');
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  if (errors > 0) {
    fail(`${errors} error(s) found — fix before deploying`);
  }
  if (warnings > 0) {
    warn(`${warnings} warning(s) — review before deploying`);
  }
  if (errors === 0 && warnings === 0) {
    pass('All environment checks passed');
  }
  console.log(`${'='.repeat(60)}\n`);

  return errors;
}

// ── Main ───────────────────────────────────────────────────────────────────

const envFile = process.argv[2] || '.env';
const env = parseEnvFile(envFile);

if (!env) {
  fail(`File not found: ${resolve(envFile)}`);
  fail('Create it from .env.example: cp .env.example .env');
  process.exit(1);
}

// Merge with process.env (process.env takes precedence for running server checks)
const merged = { ...env };
for (const key of Object.keys(process.env)) {
  if (key.startsWith('RATE_LIMIT_') || key.startsWith('VITE_') || key === 'NODE_ENV' || key === 'PORT') {
    merged[key] = process.env[key] || merged[key];
  }
}

const isProduction = (merged.NODE_ENV || '').toLowerCase() === 'production';
const errors = validateVars(merged, isProduction);
process.exit(errors > 0 ? 1 : 0);
