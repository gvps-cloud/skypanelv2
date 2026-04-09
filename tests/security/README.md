# Security Testing Suite for SkyPanelV2

This directory contains comprehensive security tests for SkyPanelV2, covering authentication security, XSS protection, and API key management.

## Test Files

### 1. `auth.test.ts` - Authentication Security Tests

Tests JWT token security, brute force protection, and password reset token strength.

**Coverage:**
- ✅ Token blacklist functionality (logout and rejection)
- ✅ Brute force protection (lockout after 5 failed attempts)
- ✅ Password reset token strength (32-byte crypto random)
- ✅ Enhanced password requirements validation

### 2. `xss.test.ts` - Cross-Site Scripting Protection Tests

Tests XSS prevention through content sanitization and security headers.

**Coverage:**
- ✅ DOMPurify sanitization of malicious HTML
- ✅ Content Security Policy (CSP) header presence
- ✅ HTTP Strict Transport Security (HSTS) header
- ✅ XSS protection headers

### 3. `apiKeys.test.ts` - API Key Security Tests

Tests API key generation, storage, and PostgreSQL Row-Level Security.

**Coverage:**
- ✅ API key generation using `crypto.randomBytes` (not `Math.random`)
- ✅ API key uniqueness guarantees
- ✅ Secure hashing before storage
- ✅ X-API-Key header authentication
- ✅ PostgreSQL Row-Level Security (RLS) for `user_api_keys` table

### 4. `admin-networking.test.ts` - Admin Networking Security Tests

Tests security of admin networking routes (rDNS, IPv6, IP management).

**Coverage:**
- ✅ Admin-only access enforcement on networking endpoints
- ✅ Input validation and SQL injection prevention for IP/rDNS fields
- ✅ Organization isolation for IP records

### 5. `animalSuffix.test.ts` - Random Label Generation Tests

Tests the `animalSuffix` utility used for generating random VPS/resource labels.

**Coverage:**
- ✅ Output entropy and uniqueness
- ✅ No predictable patterns

### 6. `api-hardening.test.ts` - General API Hardening Tests

Tests broad API security hardening measures.

**Coverage:**
- ✅ Rate limiting header presence
- ✅ Security headers (Helmet, CORS)
- ✅ CSRF token enforcement on mutating endpoints
- ✅ JSON body size limits

### 7. `linode-provider-networking.test.ts` - Provider Networking Security Tests

Tests security of provider-facing networking calls.

**Coverage:**
- ✅ Provider token isolation
- ✅ rDNS update authorization
- ✅ IPv6 range boundary validation

### 8. `ssh-keys-isolation.test.ts` - SSH Key Isolation Tests

Tests organization-scoped isolation for SSH key management.

**Coverage:**
- ✅ Users cannot access SSH keys from other organizations
- ✅ Linode sync is scoped to the requesting org's provider

### 9. `whitelabel-provider.test.ts` - White-Label Provider Tests

Tests white-label category mapping and provider abstraction security.

**Coverage:**
- ✅ Category mappings cannot leak across organizations
- ✅ Provider type is constrained to `linode`

## Running Security Tests

### Run All Security Tests

```bash
npm run test:security
```

### Run Individual Test Files

```bash
# Authentication security tests
vitest run tests/security/auth.test.ts

# XSS protection tests
vitest run tests/security/xss.test.ts

# API key security tests
vitest run tests/security/apiKeys.test.ts
```

## Security Scripts

The following npm scripts are available for comprehensive security verification:

### `npm run audit:security`

Runs npm audit to check for known vulnerabilities in dependencies:

```bash
npm run audit:security
```

- Checks for high-severity vulnerabilities
- Reports outdated packages with security issues
- Provides remediation guidance

### `npm run scan:code`

Runs Semgrep static analysis for security vulnerabilities:

```bash
npm run scan:code
```

- Detects common security vulnerabilities (SQL injection, XSS, etc.)
- Checks for insecure coding patterns
- Enforces security best practices

### `npm run verify:security`

Comprehensive security verification combining all checks:

```bash
npm run verify:security
```

This runs:
1. `npm audit --audit-level=high` - Dependency vulnerability scan
2. `semgrep --config=auto --error` - Static code analysis
3. `vitest run tests/security/` - Security test suite

## Test Dependencies

The security tests require the following development dependencies:

```json
{
  "devDependencies": {
    "vitest": "^3.2.4",
    "semgrep": "^1.0.0",
    "npm-run-all": "^4.1.5",
    "supertest": "^7.1.4",
    "@types/dompurify": "^3.0.5"
  }
}
```

## Installation

If dependencies are not already installed:

```bash
npm install --save-dev semgrep npm-run-all
```

## Test Structure

Each test file follows this structure:

```typescript
describe('Feature Name', () => {
  describe('Security Principle', () => {
    it('should verify security behavior', () => {
      // Test implementation
    });
  });
});
```

### Test Documentation

Each test includes:

1. **SECURITY TEST badge** - Identifies security-focused tests
2. **Threat Mitigated** - What attack the test prevents
3. **Security Standard** - OWASP/NIST/industry standard reference
4. **Comments** - Explanation of what is being tested

### Mock External Dependencies

Tests mock external dependencies:
- Database queries (PostgreSQL)
- HTTP requests (Supertest)
- Cryptographic functions (crypto module)
- Email services (not sent during tests)

## Continuous Integration

Add these steps to your CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Security Audit
  run: npm run audit:security

- name: Security Scan
  run: npm run scan:code

- name: Security Tests
  run: npm run test:security
```

## Security Best Practices Verified

### Authentication Security
- ✅ JWT tokens blacklisted on logout
- ✅ Brute force protection with exponential backoff
- ✅ Password reset tokens use CSPRNG (32 bytes minimum)
- ✅ Passwords hashed with bcrypt (cost factor 12+)
- ✅ Minimum password length of 8 characters
- ✅ Password complexity requirements enforced

### XSS Prevention
- ✅ DOMPurify sanitizes user-generated content
- ✅ Content Security Policy (CSP) headers configured
- ✅ HTTP Strict Transport Security (HSTS) enabled
- ✅ X-XSS-Protection header set
- ✅ X-Content-Type-Options set to 'nosniff'
- ✅ X-Frame-Options prevents clickjacking

### API Key Security
- ✅ Keys generated with `crypto.randomBytes()` (not `Math.random()`)
- ✅ Minimum 256-bit entropy for all keys
- ✅ SHA-256 hashing before storage
- ✅ Unique salt per key (prevents rainbow table attacks)
- ✅ PostgreSQL RLS enforces data isolation
- ✅ X-API-Key header authentication supported

## Troubleshooting

### Tests Fail with "Table does not exist"

Some tests check for optional security features. If these features are not yet implemented, tests will log a warning and skip gracefully.

To implement missing features:

1. Create migration for required tables (e.g., `jwt_blacklist`, `login_attempts`, `user_api_keys`)
2. Add RLS policies to PostgreSQL
3. Implement middleware for security features

### Semgrep Not Found

Install Semgrep:

```bash
# macOS
brew install semgrep

# Linux
python3 -m pip install semgrep

# Or use npx
npx semgrep --version
```

### Database Connection Required

Security tests require a running PostgreSQL database. Ensure:

1. Database is running: `npm run db:fresh`
2. Environment variables are set in `.env`
3. Database migrations are applied

## Contributing

When adding new security tests:

1. Follow the existing test structure
2. Include comprehensive documentation
3. Specify the threat mitigated and security standard
4. Mock all external dependencies
5. Make tests runnable independently
6. Add descriptive test names

## Resources

- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

## License

These security tests are part of SkyPanelV2 and follow the same license.
