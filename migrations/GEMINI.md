# SkyPanelV2 Migrations

This directory contains the SQL migration files for the SkyPanelV2 database (PostgreSQL).

## Directory Overview

These files define the database schema evolution, starting from the initial setup to incremental updates and fixes. They are executed in sequential order based on their filename prefixes.

## Naming Convention

Files follow the pattern: `XXX_description_of_change.sql`
*   `XXX`: Three-digit sequence number (e.g., `001`, `015`).
*   `description`: Brief summary of the schema change.

## Schema Structure

The database schema covers the core system:

### Core / Base System
Defined primarily in `001_initial_schema.sql` and early migrations.
*   **`users`**: Authentication and user profiles.
*   **`organizations`**: Multi-tenant grouping for users.
*   **`vps_instances`**, **`vps_plans`**: VPS hosting management.
*   **`payment_transactions`**: PayPal billing integration.
*   **`support_tickets`**: Customer support system.
*   **Activity Logs**: Audit trails (modified in `002`).

## Usage

These are raw SQL files. In the SkyPanelV2 development workflow, they are typically applied using project scripts found in the root `package.json`.

**Common Commands (run from project root):**
*   `npm run db:fresh`: **Destructive.** Drops the public schema and re-applies all migrations from scratch. Use this to reset the environment.
*   `npm run db:reset`: Interactive alias for resetting the DB.
*   `npm run seed:admin`: Populates the fresh database with a default admin user.

## Key Migrations

*   **`001_initial_schema.sql`**: Sets up `uuid-ossp`, `pgcrypto`, and core tables.
*   **`019_fix_created_by_column_type.sql`**: Example of a type fix migration.

## Notes for AI Agents

*   When creating new migrations, ensure you use the next available sequence number.
*   Check `001_initial_schema.sql` for shared utility functions like `update_updated_at_column()`.
*   Refer to the root `GEMINI.md` for broader project context.
