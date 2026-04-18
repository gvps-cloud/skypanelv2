# Dependency Review Checklist

**Requirement**: 3.3 - Manual Dependency Review Cadence
**Phase**: 3 - npm Safety Strategy
**Cadence**: Weekly operator task

---

## Overview

This document defines the manual dependency review process for SkyPanelV2. All dependency updates and vulnerability assessments are performed by operators without automated CI/CD tools.

---

## Weekly Operator Task

Every week, an operator shall perform the following dependency review:

### Step 1: Check for Outdated Packages

```bash
npm outdated
```

Review the output for:
- Packages with major version updates (breaking changes possible)
- Packages with minor/patch updates (usually safe)
- Packages that are deprecated or no longer maintained

### Step 2: Check for Vulnerabilities

```bash
npm audit
```

Review the output for:
- **Critical** severity: Immediate action required
- **High** severity: Action required within the week
- **Moderate** severity: Schedule for next maintenance window
- **Low** severity: Document and address as time permits

### Step 3: Review Changelogs

For any packages with updates available:
1. Visit the package's GitHub releases page or CHANGELOG.md
2. Review breaking changes for major version updates
3. Review security fixes for all updates
4. Document any migration steps required

---

## High-Severity Advisory Process

When `npm audit` reports a high or critical severity advisory:

### 1. Assess Impact

- [ ] Read the advisory details on npmjs.com/advisories or GitHub Advisory Database
- [ ] Determine if the vulnerable code path is used in SkyPanelV2
- [ ] Check if the vulnerability is exploitable in the current deployment

### 2. Plan the Update

- [ ] Identify the fixed version in the advisory
- [ ] Check if the fix requires a major version bump
- [ ] Review breaking changes in the changelog
- [ ] Plan any code changes required for the update

### 3. Create a PR

- [ ] Create a feature branch: `fix/deps/advisory-XXXX`
- [ ] Update the dependency version in `package.json` (exact version, no `^` prefix)
- [ ] Run `npm install` to update `package-lock.json`
- [ ] Make any required code changes for breaking changes
- [ ] Run the full test suite: `npm run test`
- [ ] Run security tests: `npm run test:security`
- [ ] Run type check: `npm run check`
- [ ] Run lint: `npm run lint`

### 4. Pre-Merge Verification

- [ ] All tests pass
- [ ] No new TypeScript errors
- [ ] No new lint errors
- [ ] `npm run audit:security` exits 0
- [ ] Manual smoke test in staging environment

### 5. Document the Update

- [ ] Add entry to CHANGELOG or release notes
- [ ] Document any configuration changes required
- [ ] Update this checklist if process improvements identified

---

## Review Checklist

Use this checklist for each weekly review:

### Outdated Packages Review

- [ ] Ran `npm outdated` and captured output
- [ ] Reviewed major version updates for breaking changes
- [ ] Reviewed changelogs for significant updates
- [ ] Documented packages requiring updates
- [ ] Created PRs for necessary updates

### Vulnerability Review

- [ ] Ran `npm audit` and captured output
- [ ] Reviewed all high/critical advisories
- [ ] Assessed exploitability for each advisory
- [ ] Created PRs for high/critical fixes
- [ ] Documented moderate/low advisories for future scheduling

### Testing Verification

- [ ] All tests pass after updates: `npm run test`
- [ ] Security tests pass: `npm run test:security`
- [ ] Type check passes: `npm run check`
- [ ] Lint passes: `npm run lint`
- [ ] Build succeeds: `npm run build`

### Documentation

- [ ] Updated dependency analysis if packages removed/added
- [ ] Documented any breaking changes handled
- [ ] Updated SECURITY.md if process changes made

---

## Prohibited Automation

The following automation tools are **NOT** permitted for SkyPanelV2 dependency management:

| Tool | Reason |
|------|--------|
| Dependabot | Hosted CI service - violates "no hosted CI" constraint |
| Renovate | Hosted automation service - violates "no hosted CI" constraint |
| Snyk | Hosted security service - violates "no hosted CI" constraint |
| Socket.dev | Hosted dependency analysis - violates "no hosted CI" constraint |
| GitHub Actions | Hosted CI/CD - violates "no hosted CI" constraint |
| Any hosted dependency automation | Violates "no hosted CI" constraint |

### Why Manual Review?

1. **Security Control**: Manual review ensures human oversight of all dependency changes
2. **Supply Chain Safety**: Prevents automatic injection of potentially malicious packages
3. **Breaking Change Awareness**: Forces review of changelogs and migration requirements
4. **Deployment Control**: Maintains control over when and how dependencies change

---

## Dependency Update Principles

### Version Pinning

All dependencies in `package.json` use exact versions (no `^` or `~` prefixes):

```json
{
  "dependencies": {
    "express": "4.21.2",
    "react": "18.3.1"
  }
}
```

This ensures:
- Reproducible builds across environments
- No unexpected minor/patch updates
- Explicit control over version changes

### Install Command

On deploy hosts, always use:

```bash
npm ci --ignore-scripts
```

This:
- Installs exact versions from `package-lock.json`
- Skips postinstall scripts (security measure)
- Ensures reproducible deployments

### Before Updating Dependencies

1. Check the current version: `npm list <package>`
2. Review the changelog for the target version
3. Test in a development environment first
4. Run the full test suite after updating
5. Document the reason for the update

---

## Emergency Security Updates

For critical security vulnerabilities requiring immediate action:

### Expedited Process

1. **Assess**: Confirm the vulnerability is exploitable in production
2. **Update**: Update to the fixed version immediately
3. **Test**: Run `npm run test:security` and smoke tests
4. **Deploy**: Deploy to production with monitoring
5. **Document**: Add post-mortem entry to security log

### Rollback Plan

If an update causes issues in production:

1. Revert to the previous `package.json` and `package-lock.json`
2. Run `npm ci --ignore-scripts`
3. Restart the application: `npm run pm2:reload`
4. Document the issue for future reference

---

## Related Documentation

- [SECURITY.md](../SECURITY.md) - Security procedures and policies
- [dependency-analysis.md](./dependency-analysis.md) - Dependency evaluation records
- [AGENTS.md](../AGENTS.md) - Development conventions and commands

---

## Review Log

| Date | Reviewer | Packages Updated | Advisories Addressed | Notes |
|------|----------|------------------|---------------------|-------|
| | | | | |
| | | | | |
| | | | | |

---

## References

- [npm audit documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [npm outdated documentation](https://docs.npmjs.com/cli/v8/commands/npm-outdated)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
