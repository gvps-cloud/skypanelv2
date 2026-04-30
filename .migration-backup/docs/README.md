# Docs Index

Operational documentation for SkyPanelV2 lives here.

## Production Flow

1. `production-checklist.md` — environment, security, and infrastructure prerequisites
2. `migration-verification.md` — database migration validation steps
3. `pre-release-verification.md` — local verification commands and smoke-test checklist
4. `rollout-checklist.md` — deployment and rollback procedure
5. `infrastructure-verification.md` — proxy, PM2, health, TLS, and network checks

## Supporting Docs

- `coverage-baseline.md` — current automated coverage snapshot
- `dependency-review.md` — manual dependency review process
- `dependency-analysis.md` — dependency analysis notes
- `notification-consolidation.md` — notification architecture decision record
- `volumes-user-flow.md` — current volume billing/admin surface and planned user flow
- `linode-coverage-matrix.md` — Linode API coverage inventory
- `linode-feature-roadmap.md` — Linode/volume roadmap context

## Recommended Release Sequence

1. Review `production-checklist.md`
2. Run `node scripts/run-migration.js` and follow `migration-verification.md`
3. Run `npm run verify:prod`
4. Follow `pre-release-verification.md`
5. Deploy with `rollout-checklist.md`
6. Confirm infrastructure expectations with `infrastructure-verification.md`
