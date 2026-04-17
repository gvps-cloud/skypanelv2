/**
 * SECURITY TEST: Every admin route must enforce authentication + authorization.
 *
 * Admin endpoints are high-privilege and the consequence of a missing guard is
 * privilege escalation. This test scans `api/routes/admin.ts` and asserts that
 * every router handler either:
 *
 *   (a) Has per-route `authenticateToken` + `requireAdmin` middleware, OR
 *   (b) Is an explicitly documented exception that performs equivalent checks
 *       in its handler body.
 *
 * When `admin.ts` is split into sub-routers (Phase 4.2), this test becomes
 * the regression harness that catches any sub-router forgetting its
 * `router.use(authenticateToken, requireAdmin)` at top.
 *
 * **Threat Mitigated:** Broken Access Control (OWASP A01)
 * **Security Standard:** OWASP ASVS V4.1 (Access Control), V4.2 (Operation-level)
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Handlers that intentionally do NOT use the standard router-level guards,
 * along with a justification and the enforcement mechanism each one uses.
 *
 * Any addition to this list must include a security review note.
 */
const INTENTIONAL_EXCEPTIONS: Array<{
  method: string;
  route: string;
  justification: string;
  enforcementMechanism: string;
}> = [
  {
    method: 'POST',
    route: '/impersonation/exit',
    justification:
      'During impersonation, req.user.role is the target user (not admin). ' +
      'Applying requireAdmin here would trap the admin inside the impersonated ' +
      'session with no way back. The handler validates the JWT manually and ' +
      'checks isImpersonating + originalAdminId claims.',
    enforcementMechanism: 'manual jwt.verify + isImpersonating claim check',
  },
  {
    method: 'GET',
    route: '/tickets/:id/stream',
    justification:
      'SSE endpoint. The EventSource API cannot send Authorization headers, ' +
      'so the token arrives via ?token= query parameter and the handler ' +
      'validates it manually. The query-param token is checked against the ' +
      'blacklist (tokenBlacklistService.isRevoked) and user role is asserted ' +
      "to be 'admin' before the stream opens.",
    enforcementMechanism: 'manual jwt.verify + role === admin SQL check + blacklist lookup',
  },
];

const ADMIN_ROUTES_FILE = path.resolve(
  process.cwd(),
  'api',
  'routes',
  'admin.ts',
);

/**
 * Extract every handler signature from admin.ts along with the middleware
 * declared on it. A "handler signature" is the text between the opening
 * `router.<method>(` and the first occurrence of `async (` or
 * `function(` — i.e. all middleware references.
 */
interface RouteHandler {
  method: string;
  route: string;
  middlewareBlock: string;
  lineNumber: number;
}

function extractHandlers(source: string): RouteHandler[] {
  const lines = source.split('\n');
  const handlers: RouteHandler[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const openMatch = line.match(/^router\.(get|post|put|delete|patch)\(/);
    if (!openMatch) continue;

    // Walk forward until we find `async (` or `function (` or `function(`
    // or until we exceed a reasonable handler-signature length.
    let sig = line;
    let route = '';
    const nextLine = i + 1;
    const maxLookahead = Math.min(i + 30, lines.length);

    // Try to extract route from same line or next lines.
    const routeMatch = sig.match(/router\.\w+\(\s*["'`]([^"'`]+)["'`]/);
    if (routeMatch) {
      route = routeMatch[1];
    } else {
      for (let j = nextLine; j < maxLookahead; j++) {
        const m = lines[j].match(/^\s*["'`]([^"'`]+)["'`]/);
        if (m) {
          route = m[1];
          break;
        }
      }
    }

    for (let j = nextLine; j < maxLookahead; j++) {
      sig += '\n' + lines[j];
      if (/async\s*\(/.test(lines[j]) || /^\s*(async\s*)?function\s*\(/.test(lines[j])) {
        break;
      }
    }

    handlers.push({
      method: openMatch[1].toUpperCase(),
      route,
      middlewareBlock: sig,
      lineNumber: i + 1,
    });
  }

  return handlers;
}

describe('Admin Route Auth Coverage', () => {
  const source = fs.readFileSync(ADMIN_ROUTES_FILE, 'utf8');
  const handlers = extractHandlers(source);

  it('admin.ts contains the expected number of route handlers (drift guard)', () => {
    // If this assertion fails because the file grew, update the expected count
    // intentionally — do not loosen the test.
    expect(handlers.length).toBeGreaterThanOrEqual(60);
  });

  it('every admin route has authenticateToken + requireAdmin OR is an intentional exception', () => {
    const missing: string[] = [];
    const unexpectedExceptions: string[] = [];

    for (const handler of handlers) {
      const hasAuth = /\bauthenticateToken\b/.test(handler.middlewareBlock);
      const hasAdmin = /\brequireAdmin\b/.test(handler.middlewareBlock);

      const isIntentionalException = INTENTIONAL_EXCEPTIONS.some(
        (ex) => ex.method === handler.method && ex.route === handler.route,
      );

      if (hasAuth && hasAdmin) {
        // Standard case, good.
        continue;
      }

      if (isIntentionalException) {
        // Expected to skip the standard guards; verified by a separate check below.
        continue;
      }

      missing.push(
        `${handler.method} ${handler.route || '(unknown route)'} ` +
          `(admin.ts:${handler.lineNumber}) — hasAuth=${hasAuth} hasAdmin=${hasAdmin}`,
      );
    }

    // Also detect stale entries in INTENTIONAL_EXCEPTIONS (a handler that was
    // removed from the codebase but still appears in the allowlist).
    for (const ex of INTENTIONAL_EXCEPTIONS) {
      const stillExists = handlers.some(
        (h) => h.method === ex.method && h.route === ex.route,
      );
      if (!stillExists) {
        unexpectedExceptions.push(
          `Intentional exception ${ex.method} ${ex.route} is no longer present ` +
            `in admin.ts. Remove it from INTENTIONAL_EXCEPTIONS.`,
        );
      }
    }

    expect(
      missing,
      `Admin routes missing authenticateToken/requireAdmin (potential privilege escalation):\n` +
        missing.map((m) => `  - ${m}`).join('\n'),
    ).toEqual([]);

    expect(
      unexpectedExceptions,
      'Stale entries in INTENTIONAL_EXCEPTIONS:\n' +
        unexpectedExceptions.map((m) => `  - ${m}`).join('\n'),
    ).toEqual([]);
  });

  it('intentional exceptions still perform equivalent auth checks in their handler body', () => {
    const violations: string[] = [];

    for (const ex of INTENTIONAL_EXCEPTIONS) {
      const handler = handlers.find(
        (h) => h.method === ex.method && h.route === ex.route,
      );
      if (!handler) continue; // Covered by the stale-entries assertion above.

      // Extract the handler body: from the handler start line to the next
      // top-level `router.` declaration (or end of file).
      const lines = source.split('\n');
      const startLine = handler.lineNumber - 1;
      let endLine = lines.length;
      for (let i = startLine + 1; i < lines.length; i++) {
        if (/^router\.(get|post|put|delete|patch|use)\(/.test(lines[i])) {
          endLine = i;
          break;
        }
      }
      const body = lines.slice(startLine, endLine).join('\n');

      // Every exception must manually verify a JWT.
      const manuallyVerifiesJwt = /jwt\.verify\(/.test(body);
      if (!manuallyVerifiesJwt) {
        violations.push(
          `${ex.method} ${ex.route}: expected manual jwt.verify() call, not found.`,
        );
      }

      // Exceptions that must assert admin role do so via a role === 'admin' check.
      if (ex.route === '/tickets/:id/stream') {
        const assertsAdminRole =
          /role\s*!==?\s*["']admin["']/.test(body) ||
          /role\s*===?\s*["']admin["']/.test(body);
        if (!assertsAdminRole) {
          violations.push(
            `${ex.method} ${ex.route}: expected explicit role === 'admin' check, not found.`,
          );
        }
      }
    }

    expect(
      violations,
      'Intentional auth exceptions no longer enforce equivalent checks:\n' +
        violations.map((v) => `  - ${v}`).join('\n'),
    ).toEqual([]);
  });
});
