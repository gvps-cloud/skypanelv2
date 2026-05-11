# SkyPanel CLI

Command-line admin toolkit for managing users, billing, platform settings, and infrastructure. Runs directly against the database and Redis — no running server required for most operations.

> **Back to**: [README](../README.md) | [Architecture](ARCHITECTURE.md) | [Development](DEVELOPMENT.md)

---

## Quick Start

```bash
# Using npm
npm run skypanel -- <resource> <action> [args]

# Or directly
node cli/skypanel.mjs <resource> <action> [args]

# Show help
node cli/skypanel.mjs --help
node cli/skypanel.mjs user --help
node cli/skypanel.mjs user unlock --help
```

## Requirements

- **Node.js** 22.22.0 (matching the project engine)
- **`.env`** file in project root with at least `DATABASE_URL` configured
- **Redis** (`REDIS_URL` in `.env`) — required for `user unlock` and `admin protect` commands that interact with brute force lockout data

---

## Resources & Actions

### `user` — User Management

Manage platform users: list, search, suspend, activate, unlock, and change roles.

#### `user list`

List all users with their role and status.

```bash
node cli/skypanel.mjs user list
node cli/skypanel.mjs user list --status suspended
node cli/skypanel.mjs user list --status active
node cli/skypanel.mjs user list --limit 100
```

| Flag | Default | Description |
|------|---------|-------------|
| `--status <active\|suspended\|inactive\|all>` | `all` | Filter by account status |
| `--limit <n>` | `50` | Maximum results |

#### `user info`

Show detailed information about a user including lockout status and organization memberships.

```bash
node cli/skypanel.mjs user info admin@example.com
node cli/skypanel.mjs user info 5076e66a-8097-4e03-9776-632c67f4be18
```

Accepts either an email address or a UUID.

**Output includes:**
- Account details (email, name, role, status, 2FA, timezone)
- Lockout status (brute force counter and lock state from Redis)
- Organization memberships with roles

#### `user search`

Search users by name or email.

```bash
node cli/skypanel.mjs user search john
node cli/skypanel.mjs user search @example.com
```

#### `user unlock`

Clear brute force lockout for a user. Removes all failed login attempt counters from Redis.

```bash
node cli/skypanel.mjs user unlock admin@example.com
node cli/skypanel.mjs user unlock 5076e66a-8097-4e03-9776-632c67f4be18
```

> **Note**: Requires `REDIS_URL` in `.env`. If Redis is unavailable, lockout data lives in-memory on the running server process and cannot be cleared remotely — restart the server to reset.

#### `user suspend`

Suspend a user account. Suspended users cannot log in or use authenticated API endpoints.

```bash
node cli/skypanel.mjs user suspend user@example.com
node cli/skypanel.mjs user suspend user@example.com --reason "Terms of service violation"
```

| Flag | Description |
|------|-------------|
| `--reason "..."` | Optional reason stored in the database for audit trail |

**Protection**: Admin users (`role = 'admin'`) **cannot be suspended**. The command will refuse and display an error. This is enforced at both the CLI and API level.

#### `user activate`

Reactivate a suspended or inactive user account.

```bash
node cli/skypanel.mjs user activate user@example.com
```

#### `user role`

Change a user's platform role.

```bash
node cli/skypanel.mjs user role user@example.com admin
node cli/skypanel.mjs user role user@example.com user
```

Valid roles: `admin`, `user`.

---

### `admin` — Admin Management

Manage and protect admin accounts.

#### `admin list`

List all admin users with their status and 2FA enrollment.

```bash
node cli/skypanel.mjs admin list
```

#### `admin protect`

Verify all admin accounts are active and unlocked. Automatically fixes any issues found:

- Resets suspended/inactive admins back to `active` status
- Clears any brute force lockout counters for admin emails

```bash
node cli/skypanel.mjs admin protect
```

> **Admin Protection**: The platform enforces that admin users can never be locked out by the brute force protection system. The `bruteForceProtectionService` skips lockout checks and failed attempt tracking entirely for admin emails. This command is a safety net for catching edge cases.

---

### `platform` — Platform Controls

Manage platform-wide settings without the admin UI.

#### `platform maintenance`

Toggle maintenance mode. When enabled, only admin users can access the platform.

```bash
node cli/skypanel.mjs platform maintenance status
node cli/skypanel.mjs platform maintenance on
node cli/skypanel.mjs platform maintenance off
```

#### `platform registration`

Toggle user registration. When disabled, new users cannot sign up.

```bash
node cli/skypanel.mjs platform registration status
node cli/skypanel.mjs platform registration on
node cli/skypanel.mjs platform registration off
```

#### `platform settings`

Display all platform settings from the database.

```bash
node cli/skypanel.mjs platform settings
```

---

### `billing` — Billing Management

View and manage customer billing.

#### `billing balance`

Show wallet balances for a user across all their organizations.

```bash
node cli/skypanel.mjs billing balance user@example.com
node cli/skypanel.mjs billing balance 5076e66a-...
```

#### `billing credit`

Add credit to a user's wallet (applies to their primary organization).

```bash
node cli/skypanel.mjs billing credit user@example.com 25.00
```

Records a `completed` payment transaction with `admin_credit` payment method and a description noting the CLI origin.

---

### `org` — Organization Management

#### `org list`

List all organizations with member counts.

```bash
node cli/skypanel.mjs org list
node cli/skypanel.mjs org list --limit 50
```

#### `org info`

Show organization details including all member accounts.

```bash
node cli/skypanel.mjs org info my-org-slug
node cli/skypanel.mjs org info 5076e66a-...
```

---

### `ticket` — Support Tickets

#### `ticket list`

List support tickets.

```bash
node cli/skypanel.mjs ticket list
node cli/skypanel.mjs ticket list --status open
node cli/skypanel.mjs ticket list --status closed
node cli/skypanel.mjs ticket list --limit 50
```

| Flag | Default | Description |
|------|---------|-------------|
| `--status <open\|closed\|all>` | `all` | Filter by ticket status |
| `--limit <n>` | `25` | Maximum results |

#### `ticket show`

Show ticket details including reply history.

```bash
node cli/skypanel.mjs ticket show <ticket-id>
```

#### `ticket close`

Close a ticket.

```bash
node cli/skypanel.mjs ticket close <ticket-id>
```

---

### `vps` — VPS Instances

#### `vps list`

List VPS instances across the platform.

```bash
node cli/skypanel.mjs vps list
node cli/skypanel.mjs vps list --org-id <organization-id>
node cli/skypanel.mjs vps list --limit 50
```

#### `vps info`

Show detailed VPS instance information.

```bash
node cli/skypanel.mjs vps info <instance-id>
```

---

### `hosting` — Hosting Subscriptions

#### `hosting list`

List hosting subscriptions.

```bash
node cli/skypanel.mjs hosting list
node cli/skypanel.mjs hosting list --limit 50
```

#### `hosting info`

Show hosting subscription details.

```bash
node cli/skypanel.mjs hosting info <subscription-id>
```

---

## Architecture

### File Structure

```
cli/
  skypanel.mjs              # Entry point + command router
  lib/
    database.mjs            # PostgreSQL connection pool (reads DATABASE_URL from .env)
    redis.mjs               # Redis client for brute force management (reads REDIS_URL from .env)
    output.mjs              # Terminal color and table formatting helpers
  commands/
    user.mjs                # 7 actions: list, info, search, unlock, suspend, activate, role
    admin.mjs               # 2 actions: list, protect
    platform.mjs            # 3 actions: maintenance, registration, settings
    billing.mjs             # 2 actions: balance, credit
    org.mjs                 # 2 actions: list, info
    ticket.mjs              # 3 actions: list, show, close
    vps.mjs                 # 2 actions: list, info
    hosting.mjs             # 2 actions: list, info
```

### Design Decisions

- **Zero external CLI dependencies** — custom argument parser, no `commander`, `yargs`, or `inquirer`
- **Direct database access** — uses `pg` Pool against `DATABASE_URL`, same pattern as `scripts/lib/database.js`
- **Direct Redis access** — uses `ioredis` for brute force lockout management
- **Reads `.env`** automatically — uses `dotenv` to load from project root
- **No server required** — all operations run against the database/Redis directly; the Express server does not need to be running

### Adding New Commands

1. Create a new file in `cli/commands/` (e.g., `cli/commands/metrics.mjs`)
2. Export an object with async functions named after each action
3. Import and register it in the `COMMANDS` map in `cli/skypanel.mjs`

Example:

```javascript
// cli/commands/metrics.mjs
import { query, closePool } from '../lib/database.mjs';
import { success, error, bold } from '../lib/output.mjs';

export const metricsCommands = {
  async summary(args) {
    const result = await query('SELECT COUNT(*) FROM users');
    console.log(bold(`Total users: ${result.rows[0].count}`));
  },
};
```

Then in `cli/skypanel.mjs`:

```javascript
import { metricsCommands } from './commands/metrics.mjs';

// Add to COMMANDS object:
metrics: {
  desc: 'Platform metrics',
  actions: {
    summary: { fn: metricsCommands.summary, desc: 'Show platform summary' },
  },
},
```

---

## User Account Status System

### Overview

The CLI manages user account status through the `users.status` column:

| Status | Effect |
|--------|--------|
| `active` | Normal access (default) |
| `inactive` | Cannot log in or use authenticated endpoints |
| `suspended` | Cannot log in or use authenticated endpoints, typically set with a reason |

### Admin Protection

Admin users (`role = 'admin'`) are protected at multiple levels:

1. **Brute force exemption** — The `bruteForceProtectionService` never tracks failed attempts or applies lockouts for admin email addresses
2. **Status enforcement** — The admin API endpoint (`PUT /api/admin/users/:id/status`) refuses to change admin user status
3. **CLI protection** — The `skypanel user suspend` command refuses to suspend admin users
4. **Auth middleware** — The `authenticateToken` middleware skips status checks for admin users
5. **`admin protect`** — The CLI's protect command auto-fixes any admin with non-active status

### Lockout vs Suspension

These are **separate mechanisms**:

| | Brute Force Lockout | Account Suspension |
|---|---|---|
| **Storage** | Redis (or in-memory) | PostgreSQL `users.status` |
| **Cause** | Too many failed login attempts | Admin action via CLI or API |
| **Resolution** | `user unlock` or auto-expiry | `user activate` |
| **Admins affected?** | Never | Never |
| **API endpoint** | `POST /api/admin/users/:id/unlock` | `PUT /api/admin/users/:id/status` |

---

## Environment Variables

| Variable | Required | Used By |
|----------|----------|---------|
| `DATABASE_URL` | Yes | All commands |
| `REDIS_URL` | For unlock/protect | `user unlock`, `admin protect` |

All other variables from `.env` are loaded but not required by the CLI.

---

## Common Workflows

### Unlock a locked-out user

```bash
# Check their status first
node cli/skypanel.mjs user info user@example.com

# Clear the lockout
node cli/skypanel.mjs user unlock user@example.com
```

### Suspend a problematic user

```bash
# Suspend with reason
node cli/skypanel.mjs user suspend baduser@example.com --reason "Spamming support tickets"

# Verify
node cli/skypanel.mjs user info baduser@example.com
```

### Emergency: disable registration during an attack

```bash
node cli/skypanel.mjs platform registration off
# ...later...
node cli/skypanel.mjs platform registration on
```

### Credit a customer's wallet

```bash
node cli/skypanel.mjs billing balance customer@example.com
node cli/skypanel.mjs billing credit customer@example.com 50.00
node cli/skypanel.mjs billing balance customer@example.com
```

### Ensure all admins are protected

```bash
node cli/skypanel.mjs admin protect
```

### Find and manage a user across resources

```bash
# Search by partial name or email
node cli/skypanel.mjs user search john

# Get full details
node cli/skypanel.mjs user info john@example.com

# Check their billing
node cli/skypanel.mjs billing balance john@example.com

# Check their VPS instances
node cli/skypanel.mjs vps list --org-id <their-org-id>

# View their tickets
node cli/skypanel.mjs ticket list --status open
```
