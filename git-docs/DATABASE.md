# Database Schema

Entity relationships, table definitions, and migration history.

> **Back to**: [README](../README.md)

---

## Entity Relationship Diagram

```text
DATABASE ENTITY OVERVIEW (selected tables)
-----------------------------------------------------------------------------
users (PK uuid)
  email (unique), password_hash, name, role, phone, timezone, preferences JSONB,
  reset_token/expires, two_factor fields, active_organization_id (FK)

organizations (PK uuid)
  name, slug (unique), owner_id (FK), settings JSONB, website, address, tax_id

organization_members (PK uuid)
  organization_id (FK), user_id (FK), role (owner/admin/member), role_id (FK)

organization_roles (PK uuid)
  organization_id (FK), name, permissions JSONB, is_default

organization_invitations (PK uuid)
  organization_id, email, token (unique), role, status, invited_by

wallets (PK uuid)
  organization_id, balance, currency

vps_instances (PK uuid)
  organization_id, plan_id, provider_instance_id, label, status, ip_address,
  configuration JSONB, last_billed_at, provider_type, provider_id, backup_frequency,
  created_by

vps_plans (PK uuid)
  name, provider_plan_id, provider_id, base_price, markup_price, specifications JSONB,
  active flag, backup pricing/upcharge columns, type_class

vps_billing_cycles (PK uuid)
  vps_instance_id, organization_id, billing period start/end, hourly_rate,
  total_amount, status, payment_transaction_id, metadata JSONB

payment_transactions (PK uuid)
  organization_id, amount, currency, payment_method/provider, provider_transaction_id,
  status, description, metadata

support_tickets / support_ticket_replies
  ticket fields (subject, message, status, priority, category, has_staff_reply),
  replies reference ticket_id + user_id with is_staff_reply flag

service_providers (PK uuid)
  name, type, encrypted API key, configuration JSONB, active flag, allowed_regions, display_order

activity_logs / activity_feed
  activity_log rows link to user_id (nullable), organization_id, event_type, entity, status, metadata

user_ssh_keys / user_api_keys
  SSH keys scoped to organization; API keys scoped to user with hashed values + permissions JSONB

platform_settings & email_templates
  key/value JSONB pairs and template definitions

invoices (PK uuid)
  organization_id, amount, status

Relationship highlights
  • users own organizations and belong via organization_members
  • organizations link to wallets, vps_instances, tickets, payments, billing cycles, SSH keys, invoices
  • vps_plans define vps_instances; service_providers supply plans and host instances
  • tickets have many replies; users create activity_logs and user_api_keys
```

---

## Migration History

The database schema is managed through **65 sequential SQL migrations** in the `migrations/` directory:

| Migration | Description |
| --------- | ----------- |
| `001` | Initial schema — users, orgs, wallets, VPS, tickets, plans, payments, providers, activity logs, billing cycles, SSH keys, FAQ, contact, platform settings |
| `002` | Relax activity_logs constraint |
| `003` | Remove legacy container artifacts |
| `004` | Add VPS notes |
| `005` | Drop PaaS tables |
| `006` | Add 2FA columns to users |
| `007` | Add VPS plan type/class and regions |
| `008` | Add VPS category mappings (white-label) |
| `009–010` | Add VPS reference and snapshot to support tickets |
| `011–015` | Organization roles, invitations, activity feed, role assignments, default role seeding |
| `016–018` | Billing view permission adjustments, remove pending from payment_transactions, add created_by to VPS instances |
| `019–022` | Active organization for users, email templates, theme preset normalization, billing view admin role |
| `023–024` | Migrate SSH keys to org scope, add created_by |
| `025–033` | Egress billing system — tables, pricing, credits, permissions, config, adjustments |
| `034` | Region display labels |
| `035` | Egress FAQ items |
| `036–045` | Documentation system — creation, seeding, comprehensive docs, branding fixes, deduplication |
| `046` | Scrub Linode references from documentation |
| `047` | FAQ dedup and unique constraint |
| `048` | Add RLS to billing/egress tables |
| `049` | Fix org role migration for unknown roles |
| `050` | Create announcements system |
| `051` | Add low-balance email template |
| `052` | Add show_on_homepage flag to organizations |
| `053` | Create personal and organization notes system |
| `054` | Fix mark-all-notifications-read to respect org scope |
| `055` | Volume pricing system |
| `056` | Add member + hosting_manager roles, hosting/egress permissions, update seed function |
| `057` | Enhance hosting schema — platform_integrations, hosting_plans, hosting_subscriptions, RLS |
| `058` | Fraud checks table for FraudLabsPro integration |
| `059` | Refunds table with PayPal capture support |
| `060` | Hosting subscriptions FK ON DELETE SET NULL — allow plan deletion without blocking old subscriptions |
| `061` | Hosting cancel support + SSO — add hosting_subscription_id to support_tickets, enhance_member_id to organizations |
| `062` | Add cancelled_at timestamp to hosting_subscriptions |
| `063` | Add updated_at column to fraud_checks (fix admin override endpoint) |
| `064` | Dedicated hosting wallets — hosting_wallets table, RLS, seed functions, balance alerts |
| `065` | Enhance hosting FAQ and documentation content |
