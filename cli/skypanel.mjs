#!/usr/bin/env node

import { closePool } from './lib/database.mjs';
import { closeRedis } from './lib/redis.mjs';
import { userCommands } from './commands/user.mjs';
import { adminCommands } from './commands/admin.mjs';
import { platformCommands } from './commands/platform.mjs';
import { billingCommands } from './commands/billing.mjs';
import { orgCommands } from './commands/org.mjs';
import { ticketCommands } from './commands/ticket.mjs';
import { vpsCommands } from './commands/vps.mjs';
import { hostingCommands } from './commands/hosting.mjs';

const VERSION = '1.0.0';

const COMMANDS = {
  user: {
    desc: 'User management commands',
    actions: {
      list:    { fn: userCommands.list,    desc: 'List users',                     usage: '[--status active|suspended|all] [--limit N]' },
      info:    { fn: userCommands.info,    desc: 'Show user details',              usage: '<email|id>' },
      search:  { fn: userCommands.search,  desc: 'Search users by name or email',  usage: '<query>' },
      unlock:  { fn: userCommands.unlock,  desc: 'Clear brute force lockout',      usage: '<email|id>' },
      suspend: { fn: userCommands.suspend, desc: 'Suspend a user account',         usage: '<email|id> [--reason "..."]' },
      activate:{ fn: userCommands.activate,desc: 'Reactivate a user account',      usage: '<email|id>' },
      role:    { fn: userCommands.role,    desc: 'Change user role',               usage: '<email|id> <admin|user>' },
    },
  },
  admin: {
    desc: 'Admin management commands',
    actions: {
      list:    { fn: adminCommands.list,    desc: 'List all admin users' },
      protect: { fn: adminCommands.protect, desc: 'Ensure all admins are active & unlocked' },
    },
  },
  platform: {
    desc: 'Platform control commands',
    actions: {
      maintenance:  { fn: platformCommands.maintenance,  desc: 'Toggle maintenance mode',  usage: '<on|off|status>' },
      registration: { fn: platformCommands.registration, desc: 'Toggle registration',       usage: '<on|off|status>' },
      settings:     { fn: platformCommands.settings,     desc: 'Show all platform settings' },
    },
  },
  billing: {
    desc: 'Billing management commands',
    actions: {
      balance: { fn: billingCommands.balance, desc: 'Show wallet balance', usage: '<email|id>' },
      credit:  { fn: billingCommands.credit,  desc: 'Add credit to wallet', usage: '<email|id> <amount>' },
    },
  },
  org: {
    desc: 'Organization management commands',
    actions: {
      list: { fn: orgCommands.list, desc: 'List organizations', usage: '[--limit N]' },
      info: { fn: orgCommands.info, desc: 'Show org details',    usage: '<id|slug>' },
    },
  },
  ticket: {
    desc: 'Support ticket commands',
    actions: {
      list:  { fn: ticketCommands.list,  desc: 'List tickets',      usage: '[--status open|closed|all] [--limit N]' },
      show:  { fn: ticketCommands.show,  desc: 'Show ticket detail', usage: '<id>' },
      close: { fn: ticketCommands.close, desc: 'Close a ticket',    usage: '<id>' },
    },
  },
  vps: {
    desc: 'VPS instance commands',
    actions: {
      list: { fn: vpsCommands.list, desc: 'List VPS instances', usage: '[--org-id ID] [--limit N]' },
      info: { fn: vpsCommands.info, desc: 'Show VPS details',   usage: '<id>' },
    },
  },
  hosting: {
    desc: 'Hosting subscription commands',
    actions: {
      list: { fn: hostingCommands.list, desc: 'List hosting subscriptions', usage: '[--limit N]' },
      info: { fn: hostingCommands.info, desc: 'Show hosting details',        usage: '<id>' },
    },
  },
};

function printHelp(resourceName, actionName) {
  const B = '\x1b[1m';
  const R = '\x1b[0m';
  const D = '\x1b[2m';
  const C = '\x1b[36m';

  if (resourceName && COMMANDS[resourceName] && actionName) {
    const action = COMMANDS[resourceName].actions[actionName];
    if (!action) {
      console.log(`Unknown action "${actionName}" for resource "${resourceName}"`);
      printHelp(resourceName);
      return;
    }
    console.log(`\n${B}skypanel ${resourceName} ${actionName}${R}\n`);
    console.log(`  ${action.desc}`);
    if (action.usage) console.log(`\n  ${D}Usage: skypanel ${resourceName} ${actionName} ${action.usage}${R}`);
    console.log();
    return;
  }

  if (resourceName && COMMANDS[resourceName]) {
    const resource = COMMANDS[resourceName];
    console.log(`\n${B}skypanel ${resourceName}${R} — ${resource.desc}\n`);
    console.log('  Actions:');
    for (const [action, def] of Object.entries(resource.actions)) {
      console.log(`    ${C}${action.padEnd(12)}${R} ${def.desc}`);
    }
    console.log();
    return;
  }

  console.log(`\n${B}skypanel${R} v${VERSION} — SkyPanel Admin CLI\n`);
  console.log('  Usage: skypanel <resource> <action> [args] [--flags]\n');
  console.log('  Resources:\n');
  for (const [name, resource] of Object.entries(COMMANDS)) {
    const actionCount = Object.keys(resource.actions).length;
    console.log(`    ${C}${name.padEnd(12)}${R} ${resource.desc} ${D}(${actionCount} actions)${R}`);
  }
  console.log();
  console.log(`  ${D}Use 'skypanel <resource>' to see available actions.${R}`);
  console.log(`  ${D}Use 'skypanel <resource> <action> --help' for detailed usage.${R}`);
  console.log();
}

async function main() {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.length === 0) {
    printHelp();
    return;
  }

  if (rawArgs[0] === '--help' || rawArgs[0] === '-h') {
    printHelp();
    return;
  }

  if (rawArgs.includes('--version') || rawArgs.includes('-v')) {
    console.log(`skypanel v${VERSION}`);
    return;
  }

  const resourceName = rawArgs[0];
  const actionName = rawArgs[1];
  const cmdArgs = rawArgs.slice(2).filter(a => a !== '--help' && a !== '-h');

  if (!COMMANDS[resourceName]) {
    console.log(`Unknown resource: ${resourceName}`);
    printHelp();
    process.exit(1);
  }

  if (!actionName || actionName === '--help' || actionName === '-h') {
    printHelp(resourceName);
    return;
  }

  const resource = COMMANDS[resourceName];
  const action = resource.actions[actionName];

  if (!action) {
    console.log(`Unknown action "${actionName}" for resource "${resourceName}"`);
    printHelp(resourceName);
    process.exit(1);
  }

  try {
    await action.fn(cmdArgs);
  } catch (err) {
    if (err.message?.includes('DATABASE_URL')) {
      console.error(`\n\x1b[31mError: DATABASE_URL not set. Ensure .env is configured.\x1b[0m\n`);
    } else if (err.code === 'ECONNREFUSED') {
      console.error(`\n\x1b[31mError: Connection refused. Is the database running?\x1b[0m\n`);
    } else {
      console.error(`\n\x1b[31mError: ${err.message}\x1b[0m`);
      if (process.env.DEBUG) console.error(err.stack);
    }
    process.exitCode = 1;
  } finally {
    await closePool();
    await closeRedis();
  }
}

main();
