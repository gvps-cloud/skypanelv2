#!/usr/bin/env node

/**
 * Install Pack CLI
 * Installs the Cloud Native Buildpacks pack CLI for building applications
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

const PACK_VERSION = 'latest'; // or specific version like 'v0.33.2'
const INSTALL_DIR = path.join(os.homedir(), '.local', 'bin');

/**
 * Check if pack CLI is already installed
 */
async function checkPackInstalled() {
  try {
    const { stdout } = await execAsync('pack version');
    return stdout.trim();
  } catch (error) {
    return null;
  }
}

/**
 * Get the latest pack release version from GitHub
 */
async function getLatestVersion() {
  try {
    const { stdout } = await execAsync(
      'curl -s https://api.github.com/repos/buildpacks/pack/releases/latest | grep "tag_name" | cut -d "\\"" -f 4'
    );
    return stdout.trim() || 'v0.33.2'; // Fallback to known version
  } catch (error) {
    console.warn('⚠️  Could not fetch latest version, using v0.33.2');
    return 'v0.33.2';
  }
}

/**
 * Detect OS and architecture
 */
function getSystemInfo() {
  const platform = os.platform();
  const arch = os.arch();
  
  let osType;
  if (platform === 'linux') osType = 'linux';
  else if (platform === 'darwin') osType = 'macos';
  else if (platform === 'win32') osType = 'windows';
  else throw new Error(`Unsupported platform: ${platform}`);
  
  let archType;
  if (arch === 'x64') archType = 'amd64';
  else if (arch === 'arm64') archType = 'arm64';
  else throw new Error(`Unsupported architecture: ${arch}`);
  
  return { os: osType, arch: archType };
}

/**
 * Download and install pack CLI
 */
async function downloadPack() {
  console.log('📥 Downloading pack CLI...');
  
  const version = await getLatestVersion();
  const { os: osType, arch } = getSystemInfo();
  
  console.log(`   Version: ${version}`);
  console.log(`   OS: ${osType}`);
  console.log(`   Architecture: ${arch}`);
  
  // Construct download URL
  // Example: https://github.com/buildpacks/pack/releases/download/v0.33.2/pack-v0.33.2-linux-amd64.tgz
  const extension = osType === 'windows' ? 'zip' : 'tgz';
  const downloadUrl = `https://github.com/buildpacks/pack/releases/download/${version}/pack-${version}-${osType}-${arch}.${extension}`;
  
  console.log(`   URL: ${downloadUrl}`);
  
  try {
    // Create install directory
    await fs.mkdir(INSTALL_DIR, { recursive: true });
    
    const tmpDir = path.join(os.tmpdir(), 'pack-install');
    await fs.mkdir(tmpDir, { recursive: true });
    
    const tmpArchive = path.join(tmpDir, `pack.${extension}`);
    
    // Download
    console.log('   Downloading...');
    await execAsync(`curl -fsSL ${downloadUrl} -o ${tmpArchive}`);
    
    // Extract
    console.log('   Extracting...');
    if (extension === 'tgz') {
      await execAsync(`tar -xzf ${tmpArchive} -C ${tmpDir}`);
    } else {
      await execAsync(`unzip -q ${tmpArchive} -d ${tmpDir}`);
    }
    
    // Move to install directory
    const packBinary = path.join(tmpDir, 'pack');
    const targetPath = path.join(INSTALL_DIR, 'pack');
    
    await fs.copyFile(packBinary, targetPath);
    await fs.chmod(targetPath, 0o755);
    
    // Cleanup
    await execAsync(`rm -rf ${tmpDir}`);
    
    console.log(`✅ Pack CLI installed to ${targetPath}`);
    console.log(`   Make sure ${INSTALL_DIR} is in your PATH`);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to install pack:', error.message);
    
    // Try alternative: use install script
    try {
      console.log('   Trying official install script...');
      await execAsync('(curl -sSL "https://github.com/buildpacks/pack/releases/download/v0.33.2/pack-v0.33.2-linux.tgz" | sudo tar -C /usr/local/bin/ --no-same-owner -xzv pack)');
      console.log('✅ Pack CLI installed via install script');
      return true;
    } catch (fallbackError) {
      console.error('❌ Alternative installation also failed:', fallbackError.message);
      return false;
    }
  }
}

/**
 * Verify pack installation
 */
async function verifyInstallation() {
  console.log('🔍 Verifying installation...');
  
  try {
    const { stdout: version } = await execAsync('pack version');
    console.log(`   Version: ${version.trim()}`);
    
    // Test pack builder list
    const { stdout: builders } = await execAsync('pack builder suggest');
    if (builders.includes('heroku/builder')) {
      console.log('✅ Pack CLI is working correctly');
      console.log('   Available builders detected');
      return true;
    }
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.error('   Make sure ~/.local/bin is in your PATH');
    console.error('   Add to ~/.bashrc or ~/.zshrc:');
    console.error('   export PATH="$HOME/.local/bin:$PATH"');
    return false;
  }
  
  return false;
}

/**
 * Check and add to PATH if needed
 */
async function ensureInPath() {
  const currentPath = process.env.PATH || '';
  
  if (currentPath.includes(INSTALL_DIR)) {
    return true;
  }
  
  console.log('⚠️  ~/.local/bin is not in your PATH');
  console.log('   Add this to your ~/.bashrc or ~/.zshrc:');
  console.log(`   export PATH="${INSTALL_DIR}:$PATH"`);
  console.log('   Then run: source ~/.bashrc (or ~/.zshrc)\n');
  
  return false;
}

/**
 * Main installation flow
 */
async function main() {
  console.log('🚀 Pack CLI Installation');
  console.log('━'.repeat(50));
  
  // Check if already installed
  const currentVersion = await checkPackInstalled();
  
  if (currentVersion) {
    console.log(`✅ Pack is already installed: ${currentVersion}`);
    
    const shouldUpdate = process.argv.includes('--update') || process.argv.includes('--force');
    if (!shouldUpdate) {
      console.log('   Use --update flag to reinstall/update');
      await ensureInPath();
      return;
    }
    
    console.log('🔄 Updating pack...');
  }
  
  // Install pack
  const installed = await downloadPack();
  if (!installed) {
    console.error('❌ Installation failed');
    process.exit(1);
  }
  
  // Verify
  const verified = await verifyInstallation();
  if (!verified) {
    console.error('❌ Verification failed');
    await ensureInPath();
    process.exit(1);
  }
  
  await ensureInPath();
  
  console.log('━'.repeat(50));
  console.log('✅ Setup complete!\n');
  console.log('Next steps:');
  console.log('  • Try: pack builder suggest');
  console.log('  • Run: npm run paas:check    # Verify all dependencies\n');
}

main().catch((error) => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
