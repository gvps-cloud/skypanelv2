# SkyPanel CLI

Admin toolkit for managing users, billing, platform settings, and infrastructure.

> **Back to**: [README](../README.md) | [Architecture](ARCHITECTURE.md) | [Development](DEVELOPMENT.md)

---

## TUI Admin Interface (v2.0)

A full-screen interactive terminal UI built with OpenTUI + React. Navigate with keyboard shortcuts (1-9) or click with mouse.

### Requirements

- **Bun** runtime — install with `powershell -c "irm bun.sh/install.ps1 | iex"` (Windows) or `curl -fsSL https://bun.sh/install | bash` (Linux/macOS)
- **Running SkyPanel server** — the TUI communicates with the Express API
- **Admin API token** — set `SKYPANEL_API_TOKEN` in `.env` to either an admin JWT or an admin-owned `sk_live_*` API key

### Quick Start

```bash
# Install Bun (if not already installed)
# Windows:
powershell -c "irm bun.sh/install.ps1 | iex"
# Linux/macOS:
curl -fsSL https://bun.sh/install | bash

# Install CLI dependencies
cd cli && bun install && cd ..

# Set env vars
SKYPANEL_API_URL=http://localhost:3001
SKYPANEL_API_TOKEN=your-admin-jwt-or-sk-live-api-key

# Launch TUI
npm run skypanel
```

### Navigation

| Key | Action |
|-----|--------|
| `1-9` | Switch screens |
| `Up/Down` | Navigate lists |
| `Enter` | Select item / confirm |
| `Tab` | Cycle focus |
| `Escape` | Cancel / close dialog |
| `Ctrl+C` | Exit |

### Screens

| # | Screen | Features |
|---|--------|----------|
| 1 | **Dashboard** | Platform overview, health, billing summary |
| 2 | **Users** | List, search, detail, role change, delete |
| 3 | **Organizations** | List, detail, members, create (with owner), update, delete, add members |
| 4 | **Servers** | List instances, detail, boot, shutdown, reboot, delete |
| 5 | **Hosting** | List subscriptions, suspend, unsuspend, retry billing |
| 6 | **Tickets** | List with status filter, detail + replies, reply, close, reopen, delete |
| 7 | **Billing** | Stats overview, transactions, manual credit/debit adjustments |
| 8 | **Platform** | Maintenance toggle, registration toggle, health check |
| 9 | **Blog** | List posts, publish, unpublish, delete |

### Architecture

```
cli/
  skypanel.tsx             # Entry point: validate config, test API, then boot OpenTUI
  package.json             # Bun package with @opentui/core, @opentui/react, dotenv
  tsconfig.json            # JSX config
  theme.ts                 # Centralized palette + getStatusColor()

  lib/
    client.ts              # HTTP API client (JWT/API-key auth, normalized base URL)
    config.ts              # Environment variable loading and validation

  components/
    App.tsx                # Root layout: sidebar + content + status bar + toast
    Sidebar.tsx            # Navigation sidebar
    StatusBar.tsx          # Connection info bar
    DataTable.tsx          # Scrollable list with columns and search
    DetailPanel.tsx        # Key-value detail view with action buttons
    FormDialog.tsx         # Modal form for inputs
    ConfirmDialog.tsx      # Destructive action confirmation
    Toast.tsx              # Success/error notifications

  screens/
    MetricsScreen.tsx      # Dashboard / platform overview
    UsersScreen.tsx        # User management
    OrgsScreen.tsx         # Organization management
    VpsScreen.tsx          # Server power control
    HostingScreen.tsx      # Hosting subscription management
    TicketsScreen.tsx      # Support ticket management
    BillingScreen.tsx      # Billing and transactions
    PlatformScreen.tsx     # Platform controls
    BlogScreen.tsx         # Blog CMS
```

All screens communicate with the live SkyPanel Express API (`/api/admin/*` endpoints). The TUI makes real API calls — boot, delete, publish, etc. all take effect immediately.

### Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `SKYPANEL_API_URL` | Yes | Base URL of the SkyPanel API (e.g. `http://localhost:3001`; trailing `/api` is also accepted) |
| `SKYPANEL_API_TOKEN` | Yes | Admin JWT or admin-owned `sk_live_*` API key from `/settings` |

The `SKYPANEL_API_URL` is normalized automatically. Both `http://localhost:3001` and `http://localhost:3001/api` work; the CLI stores the API origin internally and sends requests to `/api/...` routes.

### Common Workflows

#### Check platform health
Open the **Dashboard** screen (1) to see user counts, VPS status, open tickets, revenue, and system health.

#### Manage users
Open the **Users** screen (2). Navigate the list with Up/Down, press Enter to view details. Use "Set Role" to change between `admin` and `user`. Use "Delete" to remove a user (blocked if they have active resources).

#### Manage servers
Open the **Servers** screen (4). Select a server to see its details. Use "Boot", "Shutdown", or "Reboot" to control power state. Use "Delete" to permanently remove the instance.

#### Handle support tickets
Open the **Tickets** screen (6). Filter by `open`, `in_progress`, or `all`. Select a ticket to view replies. Use "Reply" to respond, "Close" to resolve, or "Reopen" to escalate.

#### Adjust billing
Open the **Billing** screen (7). The Overview tab shows revenue and wallet totals. Switch to the Transactions tab to view individual payments. Press "+ Adjust" to manually credit or debit a user's wallet.

#### Toggle maintenance mode
Open the **Platform** screen (8). The current maintenance and registration states are shown. Use the action buttons to toggle them. A confirmation dialog will appear before applying.

#### Manage blog posts
Open the **Blog** screen (9). Select a post to see its status. Use "Publish" or "Unpublish" to change visibility. Use "Delete" to remove.

---

## Environment Variables

All CLI configuration is loaded from `.env` in the project root:

```bash
SKYPANEL_API_URL=http://localhost:3001
SKYPANEL_API_TOKEN=your-admin-jwt-or-sk-live-api-key
```

If required variables are missing, the CLI prints a setup help message and exits before initializing the terminal UI. The token must authenticate an admin user; non-admin API keys are rejected at startup.
