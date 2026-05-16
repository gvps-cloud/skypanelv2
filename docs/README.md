# Docs Index

Operational and feature documentation for SkyPanelV2. For developer reference (architecture, backend, frontend, database, security), see [git-docs/](../git-docs/) and the [main README](../README.md).

---

## Recommended Release Sequence

1. Review [Production Checklist](operational/production-checklist.md)
2. Run `node scripts/run-migration.js` and follow [Migration Verification](operational/migration-verification.md)
3. Run `npm run verify:prod`
4. Follow [Pre-Release Verification](operational/pre-release-verification.md)
5. Deploy with [Rollout Checklist](operational/rollout-checklist.md)
6. Confirm infrastructure expectations with [Infrastructure Verification](operational/infrastructure-verification.md)

---

## Security

| Document | Description |
|---|---|
| [Security Policy](security/POLICY.md) | Vulnerability reporting, dependency audit gates, SBOM generation, CORS, accepted risk register |
| [XSS Protection](security/XSS_PROTECTION.md) | XSS protection implementation record (Helmet CSP, DOMPurify, OWASP mapping) |

## Operational

| Document | Description |
|---|---|
| [Production Checklist](operational/production-checklist.md) | Pre-deployment checklist (~60 items across 9 categories) |
| [Pre-Release Verification](operational/pre-release-verification.md) | Verification procedure to run before every release |
| [Rollout Checklist](operational/rollout-checklist.md) | Step-by-step deployment and rollback procedure |
| [Infrastructure Verification](operational/infrastructure-verification.md) | Proxy config (Caddy/Nginx), PM2, health, TLS checks |
| [Migration Verification](operational/migration-verification.md) | Database migration validation and development rules |

## Dependency Management

| Document | Description |
|---|---|
| [Dependency Review](dependency/review.md) | Weekly dependency review process and policy |
| [Dependency Analysis](dependency/analysis.md) | Unused dependency analysis and removal recommendations |

## Coverage

| Document | Description |
|---|---|
| [Coverage Baseline](coverage/baseline.md) | Current test coverage snapshot, security test inventory, and coverage goals |

## Features

| Document | Description |
|---|---|
| [PWA Setup](features/pwa-setup.md) | Progressive Web App configuration, testing, and deployment |
| [Linode Coverage Matrix](features/linode-coverage-matrix.md) | Frontend-to-API-to-Linode mapping (all implemented features) |
| [Linode Feature Roadmap](features/linode-feature-roadmap.md) | Feature parity status, backlog, and out-of-scope items |
| [Enhance Hosting Coverage](features/enhance-hosting-coverage.md) | Enhance API operation coverage by hosting detail tab |
| [Notification Consolidation](features/notification-consolidation.md) | Architecture decision record for notification route unification |
| [Volumes User Flow](features/volumes-user-flow.md) | Block storage volume management (admin surface and planned user flow) |
