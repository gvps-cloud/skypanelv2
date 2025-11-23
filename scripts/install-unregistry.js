#!/usr/bin/env node

/**
 * Install Unregistry (docker pussh)
 * Installs the unregistry Docker plugin for SSH-based image distribution
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

/**
 * Check if Docker is installed
 */
async function checkDockerInstalled() {
  try {
    const { stdout } = await execAsync('docker --version');
    return stdout.trim();
  } catch (error) {
    return null;
  }
}

/**
 * Check if unregistry (docker pussh) is installed
 */
async function checkUnregistryInstalled() {
  try {
    const { stdout } = await execAsync('docker pussh --help');
    if (stdout.includes('pussh') || stdout.includes('unregistry')) {
      return true;
    }
  } catch (error) {
    return false;
  }
  return false;
}

/**
 * Install unregistry plugin
 */
async function installUnregistry() {
  console.log('📥 Installing unregistry (docker pussh)...');
  
  const platform = os.platform();
  const cliPluginsDir = path.join(os.homedir(), '.docker', 'cli-plugins');
  
  try {
    // Ensure cli-plugins directory exists
    await fs.mkdir(cliPluginsDir, { recursive: true });
    
    // Download the plugin
    const arch = os.arch() === 'x64' ? 'amd64' : os.arch();
    let osType;
    
    if (platform === 'linux') osType = 'linux';
    else if (platform === 'darwin') osType = 'darwin';
    else if (platform === 'win32') osType = 'windows';
    else throw new Error(`Unsupported platform: ${platform}`);
    
    const downloadUrl = `https://unregistry.run/download/${osType}/${arch}/docker-pussh`;
    const targetPath = path.join(cliPluginsDir, 'docker-pussh');
    
    console.log(`   Downloading from: ${downloadUrl}`);
    console.log(`   Target: ${targetPath}`);
    
    // Download using curl
    await execAsync(`curl -fsSL ${downloadUrl} -o ${targetPath}`);
    
    // Make executable
    await fs.chmod(targetPath, 0o755);
    
    console.log('✅ Unregistry plugin installed');
    return true;
  } catch (error) {
    console.error('❌ Failed to install unregistry:', error.message);
    
    // Fallback: Try using Docker plugin install (if available)
    try {
      console.log('   Trying alternative installation method...');
      await execAsync('docker plugin install unregistry/pussh --grant-all-permissions');
      console.log('✅ Unregistry plugin installed via Docker plugin system');
      return true;
    } catch (fallbackError) {
      console.error('❌ Alternative installation also failed:', fallbackError.message);
      return false;
    }
  }
}

/**
 * Verify unregistry installation
 */
async function verifyInstallation() {
  console.log('🔍 Verifying installation...');
  
  try {
    const { stdout } = await execAsync('docker pussh --help');
    if (stdout.includes('pussh') || stdout.includes('SSH')) {
      console.log('✅ Unregistry (docker pussh) is working correctly');
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
  console.log('🚀 Unregistry Installation');
  console.log('━'.repeat(50));
  
  // Check Docker first
  const dockerVersion = await checkDockerInstalled();
  if (!dockerVersion) {
    console.error('❌ Docker is not installed!');
    console.error('   Please install Docker first: https://docs.docker.com/get-docker/');
    process.exit(1);
  }
  
  console.log(`✅ Docker is installed: ${dockerVersion}`);
  
  // Check if already installed
  const alreadyInstalled = await checkUnregistryInstalled();
  
  if (alreadyInstalled) {
    console.log('✅ Unregistry is already installed');
    
    const shouldReinstall = process.argv.includes('--update') || process.argv.includes('--force');
    if (!shouldReinstall) {
      console.log('   Use --update flag to reinstall');
      return;
    }
    
    console.log('🔄 Reinstalling unregistry...');
  }
  
  // Install unregistry
  const installed = await installUnregistry();
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
  console.log('  • You can now use: docker pussh <image> <user>@<host>');
  console.log('  • Run: npm run paas:check    # Verify all dependencies\n');
}

main().catch((error) => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
