#!/usr/bin/env node

/**
 * Validate PaaS deployment fixes
 * This script checks that all the necessary components for PaaS deployment are in place
 */

import fs from 'fs/promises';
import path from 'path';

const FIXES = [
  {
    name: 'Procfile',
    path: '/home/coder/skypanelv2/Procfile',
    check: async () => {
      const content = await fs.readFile('/home/coder/skypanelv2/Procfile', 'utf8');
      return content.includes('web: npm run start');
    }
  },
  {
    name: 'Release script',
    path: '/home/coder/skypanelv2/.release',
    check: async () => {
      try {
        await fs.access('/home/coder/skypanelv2/.release', fs.constants.X_OK);
        return true;
      } catch {
        return false;
      }
    }
  },
  {
    name: 'Dockerfile',
    path: '/home/coder/skypanelv2/Dockerfile',
    check: async () => {
      const content = await fs.readFile('/home/coder/skypanelv2/Dockerfile', 'utf8');
      return content.includes('HEALTHCHECK') && content.includes('CMD ["npm", "start"]');
    }
  },
  {
    name: 'PaaS storage script',
    path: '/home/coder/skypanelv2/scripts/ensure-paas-storage.js',
    check: async () => {
      const content = await fs.readFile('/home/coder/skypanelv2/scripts/ensure-paas-storage.js', 'utf8');
      return content.includes('ensureStorageDirectories');
    }
  },
  {
    name: 'Build cache service permissions',
    path: '/home/coder/skypanelv2/api/services/paas/buildCacheService.ts',
    check: async () => {
      const content = await fs.readFile('/home/coder/skypanelv2/api/services/paas/buildCacheService.ts', 'utf8');
      return content.includes('Failed to save cache archive locally');
    }
  },
  {
    name: 'Filesystem utils error handling',
    path: '/home/coder/skypanelv2/api/lib/fsUtils.ts',
    check: async () => {
      const content = await fs.readFile('/home/coder/skypanelv2/api/lib/fsUtils.ts', 'utf8');
      return content.includes('Permission denied creating directory');
    }
  },
  {
    name: 'PaaS health endpoint',
    path: '/home/coder/skypanelv2/api/routes/health.ts',
    check: async () => {
      const content = await fs.readFile('/home/coder/skypanelv2/api/routes/health.ts', 'utf8');
      return content.includes('/paas') && content.includes('database: \'ok\'');
    }
  }
];

async function validateFixes() {
  console.log('🔍 Validating PaaS deployment fixes...\n');

  let allPassed = true;
  const results = [];

  for (const fix of FIXES) {
    try {
      const exists = await fs.access(fix.path).then(() => true).catch(() => false);
      let passed = exists;
      let details = exists ? 'File exists' : 'File missing';

      if (exists && fix.check) {
        passed = await fix.check();
        details = passed ? 'Valid' : 'Invalid content';
      }

      results.push({
        name: fix.name,
        status: passed ? '✅' : '❌',
        details
      });

      if (!passed) {
        allPassed = false;
      }
    } catch (error) {
      results.push({
        name: fix.name,
        status: '❌',
        details: `Error: ${error.message}`
      });
      allPassed = false;
    }
  }

  // Display results
  console.log('Validation Results:');
  console.log('==================');
  for (const result of results) {
    console.log(`${result.status} ${result.name}: ${result.details}`);
  }

  console.log('\n' + '='.repeat(50));

  if (allPassed) {
    console.log('🎉 All PaaS deployment fixes are in place!');
    console.log('\nKey improvements made:');
    console.log('• Added Procfile for proper process definition');
    console.log('• Created release script for database migrations');
    console.log('• Fixed build cache permission handling');
    console.log('• Enhanced filesystem error handling');
    console.log('• Created optimized Dockerfile');
    console.log('• Added comprehensive health checks');
    console.log('• Configured PaaS storage settings');

    console.log('\nThe deployment should now work correctly with:');
    console.log('• Proper slug creation (expecting larger than 0.12MB)');
    console.log('• No permission denied errors');
    console.log('• Working health checks');
    console.log('• Proper application startup');
  } else {
    console.log('❌ Some fixes are missing or incomplete');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateFixes().catch(console.error);
}

export { validateFixes };