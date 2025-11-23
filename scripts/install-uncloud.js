#!/usr/bin/env node

/**
 * Install Uncloud CLI
 * Automates the installation and update of the uncloud CLI
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

const UNCLOUD_VERSION = 'latest';
const INSTALL_DIR = path.join(os.homedir(), '.local', 'bin');

/**
 * Check if uncloud CLI is already installed
 */
async function checkUncloudInstalled() {
  try {
    const { stdout } = await execAsync('uc --version');
    return stdout.trim();
  } catch (error) {
    return null;
  }
}

/**
 * Detect OS and architecture
 */
function getSystemInfo() {
  const platform = os.platform(); // 'linux', 'darwin', 'win32'
  const arch = os.arch(); // 'x64', 'arm64'
  
  let osType;
  if (platform === 'linux') osType = 'linux';
  else if (platform === 'darwin') osType = 'darwin';
  else if (platform === 'win32') osType = 'windows';
  else throw new Error(`Unsupported platform: ${platform}`);
  
  let archType;
  if (arch === 'x64') archType = 'amd64';
  else if (arch === 'arm64') archType = 'arm64';
  else throw new Error(`Unsupported architecture: ${arch}`);
  
  return { os: osType, arch: archType };
}

/**
 * Download and install uncloud CLI
 */
async function downloadUncloud() {
  console.log('📥 Downloading uncloud CLI...');
  
  const { os: osType, arch } = getSystemInfo();
  
  // Use official install script for Linux/macOS
  if (osType === 'linux' || osType === 'darwin') {
    console.log('   Using official install script...');
    try {
      await execAsync('curl -fsSL https://uncloud.run/install | sh');
      console.log('✅ Uncloud CLI installed successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to install via script:', error.message);
      return false;
    }
  }
  
  // Windows not officially supported yet
  console.error('❌ Windows is not officially supported by uncloud yet');
  return false;
}

/**
 * Verify uncloud installation
 */
async function verifyInstallation() {
  console.log('🔍 Verifying installation...');
  
  try {
    const { stdout } = await execAsync('uc --version');
    console.log(`   Version: ${stdout.trim()}`);
    
    // Test basic connectivity
    const { stdout: helpOutput } = await execAsync('uc --help');
    if (helpOutput.includes('uncloud')) {
      console.log('✅ Uncloud CLI is working correctly');
      return true;
    }
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    return false;
  }
  
  return false;
}

/**
 * Main installation flow
 */
async function main() {
  console.log('🚀 Uncloud CLI Installation');
  console.log('━'.repeat(50));
  
  // Check if already installed
  const currentVersion = await checkUncloudInstalled();
  
  if (currentVersion) {
    console.log(`✅ Uncloud is already installed: ${currentVersion}`);
    console.log('   Run this script again to update to the latest version');
    
    // Ask if user wants to update
    const shouldUpdate = process.argv.includes('--update') || process.argv.includes('--force');
    if (!shouldUpdate) {
      console.log('   Use --update flag to reinstall/update');
      return;
    }
    
    console.log('🔄 Updating uncloud...');
  }
  
  // Install uncloud
  const installed = await downloadUncloud();
  if (!installed) {
    console.error('❌ Installation failed');
    process.exit(1);
  }
  
  // Verify
  const verified = await verifyInstallation();
  if (!verified) {
    console.error('❌ Verification failed');
    process.exit(1);
  }
  
  console.log('━'.repeat(50));
  console.log('✅ Setup complete!\n');
  console.log('Next steps:');
  console.log('  1. Run: npm run paas:setup    # Install all PaaS dependencies');
  console.log('  2. Run: npm run paas:check    # Verify setup\n');
}

main().catch((error) => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
