#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

/**
 * Check if a command exists
 */
async function checkCommand(command, name) {
  try {
    const { stdout } = await execAsync(`${command} --version 2>&1`);
    const version = stdout.trim().split('\n')[0];
    console.log(`${colors.green}✅ ${name}: ${version}${colors.reset}`);
    return { installed: true, version };
  } catch (error) {
    console.log(`${colors.red}❌ ${name}: Not installed${colors.reset}`);
    return { installed: false };
  }
}

/**
 * Check Docker and Docker Compose
 */
async function checkDockerStack() {
  console.log(`\n${colors.bold}${colors.blue}Docker Stack:${colors.reset}`);
  
  const docker = await checkCommand('docker', 'Docker');
  
  let dockerCompose = await checkCommand('docker-compose', 'Docker Compose');
  if (!dockerCompose.installed) {
    // Try docker compose plugin
    try {
      const { stdout } = await execAsync('docker compose version 2>&1');
      const version = stdout.trim().split('\n')[0];
      console.log(`${colors.green}✅ Docker Compose (Plugin): ${version}${colors.reset}`);
      dockerCompose = { installed: true, version };
    } catch (e) {
      console.log(`${colors.red}❌ Docker Compose: Not installed${colors.reset}`);
    }
  }
  
  return docker.installed && dockerCompose.installed;
}

/**
 * Check PaaS dependencies
 */
async function checkPaaSDependencies() {
  console.log(`\n${colors.bold}${colors.blue}PaaS Dependencies:${colors.reset}`);
  
  const uncloud = await checkCommand('uc', 'Uncloud CLI');
  const pack = await checkCommand('pack', 'Pack CLI (Buildpacks)');
  
  // Check unregistry plugin
  let unregistry = { installed: false };
  try {
    const { stdout } = await execAsync('docker pussh --help 2>&1');
    if (stdout.includes('pussh') || stdout.includes('Push images via SSH')) {
      console.log(`${colors.green}✅ Unregistry (docker pussh): Installed${colors.reset}`);
      unregistry.installed = true;
    } else {
      throw new Error('Not found');
    }
  } catch (error) {
    console.log(`${colors.red}❌ Unregistry (docker pussh): Not installed${colors.reset}`);
  }
  
  return {
    allInstalled: uncloud.installed && pack.installed && unregistry.installed,
    uncloud,
    pack,
    unregistry
  };
}

/**
 * Check Node.js and npm
 */
async function checkNodeStack() {
  console.log(`\n${colors.bold}${colors.blue}Node.js Stack:${colors.reset}`);
  
  const node = await checkCommand('node', 'Node.js');
  const npm = await checkCommand('npm', 'npm');
  
  return node.installed && npm.installed;
}

/**
 * Check PostgreSQL connection
 */
async function checkDatabase() {
  console.log(`\n${colors.bold}${colors.blue}Database:${colors.reset}`);
  
  // Try to load database connection from project
  try {
    // Dynamic import for the database module
    // Note: We need to handle the fact that this might be a TS file or JS file depending on build
    // For now, we'll try to connect using pg directly if the module load fails
    // or just skip deep DB check and rely on the fact that the app starts
    
    // Simple check using pg directly to avoid importing app code that might have complex deps
    const { Client } = await import('pg');
    // We need to read .env file manually since we're not loading the app
    const dotenv = await import('dotenv');
    dotenv.config();
    
    if (!process.env.DATABASE_URL) {
        console.log(`${colors.yellow}⚠️  DATABASE_URL not found in environment${colors.reset}`);
        return false;
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });
    
    await client.connect();
    await client.query('SELECT 1');
    await client.end();

    console.log(`${colors.green}✅ PostgreSQL: Connected${colors.reset}`);
    return true;
  } catch (error) {
    console.log(`${colors.red}❌ PostgreSQL: Connection failed${colors.reset}`);
    console.log(`   ${colors.yellow}Error: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Main health check
 */
async function main() {
  console.log(`${colors.bold}${colors.blue}
╔═══════════════════════════════════════╗
║   PaaS Platform Health Check        ║
╚═══════════════════════════════════════╝
${colors.reset}`);
  
  const nodeOk = await checkNodeStack();
  const dockerOk = await checkDockerStack();
  const paasResult = await checkPaaSDependencies();
  const dbOk = await checkDatabase();
  
  console.log(`\n${colors.bold}${colors.blue}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}Summary:${colors.reset}\n`);
  
  if (nodeOk && dockerOk && paasResult.allInstalled && dbOk) {
    console.log(`${colors.green}${colors.bold}✅ All systems operational!${colors.reset}`);
    console.log(`\n${colors.blue}Your PaaS platform is ready to deploy applications.${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.yellow}${colors.bold}⚠️  Some dependencies are missing:${colors.reset}\n`);
    
    if (!paasResult.uncloud.installed) {
      console.log(`   ${colors.red}•${colors.reset} Uncloud CLI - Run: ${colors.blue}npm run install:uncloud${colors.reset}`);
    }
    if (!paasResult.pack.installed) {
      console.log(`   ${colors.red}•${colors.reset} Pack CLI - Run: ${colors.blue}npm run install:pack${colors.reset}`);
    }
    if (!paasResult.unregistry.installed) {
      console.log(`   ${colors.red}•${colors.reset} Unregistry Plugin - Run: ${colors.blue}npm run install:unregistry${colors.reset}`);
    }
    if (!dockerOk) {
      console.log(`   ${colors.red}•${colors.reset} Docker - Visit: ${colors.blue}https://docs.docker.com/get-docker/${colors.reset}`);
    }
    if (!dbOk) {
      console.log(`   ${colors.red}•${colors.reset} PostgreSQL - Check database connection settings${colors.reset}`);
    }
    
    console.log(`\n${colors.yellow}Run ${colors.bold}npm run paas:setup${colors.reset}${colors.yellow} to install missing PaaS dependencies.${colors.reset}\n`);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { main };
