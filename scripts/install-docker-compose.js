import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

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

async function checkCommand(command) {
  try {
    await execAsync(`${command} version`);
    return true;
  } catch {
    return false;
  }
}

async function installDockerCompose() {
  console.log(`${colors.blue}${colors.bold}Checking Docker Compose installation...${colors.reset}`);

  const hasStandalone = await checkCommand('docker-compose');
  const hasPlugin = await checkCommand('docker compose');

  if (hasStandalone && hasPlugin) {
    console.log(`${colors.green}✅ Docker Compose is already installed (standalone and plugin).${colors.reset}`);
    return;
  }

  console.log(`${colors.yellow}Installing Docker Compose...${colors.reset}`);

  const platform = os.platform();
  const arch = os.arch();
  
  if (platform !== 'linux') {
    console.log(`${colors.yellow}⚠️  Automatic installation is only supported on Linux.${colors.reset}`);
    return;
  }

  // Determine architecture for download
  const binaryArch = arch === 'x64' ? 'x86_64' : arch === 'arm64' ? 'aarch64' : null;
  if (!binaryArch) {
    console.log(`${colors.red}❌ Unsupported architecture: ${arch}${colors.reset}`);
    return;
  }

  const version = 'v2.29.1'; // Recent stable version
  const url = `https://github.com/docker/compose/releases/download/${version}/docker-compose-linux-${binaryArch}`;
  const targetPath = '/usr/local/bin/docker-compose';
  const pluginPath = '/usr/libexec/docker/cli-plugins/docker-compose';

  try {
    // 1. Install Standalone
    if (!hasStandalone) {
      console.log(`Downloading standalone binary from ${url}...`);
      await execAsync(`curl -SL ${url} -o ${targetPath}`);
      await execAsync(`chmod +x ${targetPath}`);
      console.log(`${colors.green}✅ Installed docker-compose standalone to ${targetPath}${colors.reset}`);
    }

    // 2. Install Plugin (symlink if possible, or download to plugin dir)
    if (!hasPlugin) {
      console.log('Setting up Docker Compose plugin...');
      // Check standard plugin directories
      const pluginDirs = [
        '/usr/local/lib/docker/cli-plugins',
        '/usr/lib/docker/cli-plugins',
        `${os.homedir()}/.docker/cli-plugins`
      ];

      let installDir = pluginDirs[0];
      // Try to find an existing dir or create one
      for (const dir of pluginDirs) {
        try {
          await execAsync(`mkdir -p ${dir}`);
          installDir = dir;
          break;
        } catch (e) {
          // continue
        }
      }

      const targetPlugin = path.join(installDir, 'docker-compose');
      
      // Try to symlink first to save space/time
      try {
        await execAsync(`ln -sf ${targetPath} ${targetPlugin}`);
        console.log(`${colors.green}✅ Linked docker-compose plugin to ${targetPlugin}${colors.reset}`);
      } catch (e) {
        // Fallback to copy/download
        await execAsync(`cp ${targetPath} ${targetPlugin}`);
        console.log(`${colors.green}✅ Installed docker-compose plugin to ${targetPlugin}${colors.reset}`);
      }
      
      await execAsync(`chmod +x ${targetPlugin}`);
    }

    // Verify
    const finalStandalone = await checkCommand('docker-compose');
    const finalPlugin = await checkCommand('docker compose');

    if (finalStandalone && finalPlugin) {
      console.log(`${colors.green}${colors.bold}🎉 Docker Compose installation complete!${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠️  Installation finished but verification failed. Please check your path.${colors.reset}`);
    }

  } catch (error) {
    console.error(`${colors.red}❌ Installation failed: ${error.message}${colors.reset}`);
    console.log(`${colors.yellow}You may need to run this with sudo or install manually.${colors.reset}`);
  }
}

installDockerCompose();
