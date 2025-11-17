#!/usr/bin/env node

/**
 * Redis Service Check and Start Script
 * Ensures Redis is running before starting the development servers
 */

import { execSync, exec } from 'child_process';
import fs from 'fs';
import path from 'path';

function isRedisRunning() {
  try {
    const result = execSync('redis-cli ping', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000
    }).trim();
    return result === 'PONG';
  } catch (error) {
    return false;
  }
}

function startRedis() {
  console.log('🔄 Redis is not running. Starting Redis service...');

  try {
    // Try different service managers based on the platform
    const commands = [
      'sudo service redis-server start',     // SysV init
      'sudo systemctl start redis',          // Systemd
      'sudo service redis_6379 start',       // Alternative service name
      'redis-server',                        // Direct command (for development)
    ];

    for (const cmd of commands) {
      try {
        console.log(`Attempting: ${cmd}`);
        execSync(cmd, { stdio: 'inherit' });

        // Wait a moment for Redis to start
        setTimeout(() => {
          if (isRedisRunning()) {
            console.log('✅ Redis started successfully!');
            return;
          }
        }, 2000);

        break;
      } catch (error) {
        console.log(`Command failed: ${cmd} - ${error.message}`);
        continue;
      }
    }

    // Final check
    if (isRedisRunning()) {
      console.log('✅ Redis is now running!');
    } else {
      console.warn('⚠️  Could not start Redis automatically. Please start Redis manually.');
      console.warn('   - Linux: sudo service redis-server start');
      console.warn('   - macOS: brew services start redis');
      console.warn('   - Windows: redis-server');
    }
  } catch (error) {
    console.error('❌ Failed to start Redis:', error.message);
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🔍 Checking Redis status...');

  if (isRedisRunning()) {
    console.log('✅ Redis is already running!');
  } else {
    startRedis();
  }

  // Final status check
  setTimeout(() => {
    if (isRedisRunning()) {
      console.log('🎉 Redis is ready for development!');
      process.exit(0);
    } else {
      console.error('❌ Redis is not available. Please start it manually.');
      process.exit(1);
    }
  }, 3000);
}

export { isRedisRunning, startRedis };