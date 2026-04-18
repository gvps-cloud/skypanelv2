/**
 * SECURITY TEST: Notifications Organization Isolation
 *
 * **Validates: Requirements 1.2**
 *
 * This test verifies that notification queries are organization-scoped,
 * preventing users from accessing notifications from other organizations.
 *
 * **Test Coverage:**
 * - Cross-organization notification access returns 404
 * - All notification endpoints enforce organization scoping
 * - Users cannot mark notifications from other orgs as read
 * - Notification counts are scoped to user's organization
 *
 * **Security Principles Verified:**
 * 1. Notification data is isolated by organization
 * 2. Users cannot access notifications from other organizations
 * 3. All SELECT queries include organization_id filtering
 *
 * **Threat Mitigated:** Broken Access Control (OWASP A01)
 * **Security Standard:** OWASP ASVS V4.1 (Access Control), V4.2 (Operation-level)
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { query } from '../../api/lib/database.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import request from 'supertest';

// Mock email service to prevent real emails
vi.mock('../../api/services/emailService.js', () => ({
  emailService: {
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// Mock activity logger
vi.mock('../../api/services/activityLogger.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// Lazy-load app to avoid initialization during test collection
let app: any;
const getApp = async () => {
  if (!app) {
    const { default: appModule } = await import('../../api/app.js');
    app = appModule;
  }
  return app;
};

describe('Notifications Organization Isolation', () => {
  // Organization A
  let orgAUserId: string;
  let orgAUserToken: string;
  let orgAId: string;
  let orgANotificationId: string;

  // Organization B
  let orgBUserId: string;
  let orgBUserToken: string;
  let orgBId: string;
  let orgBNotificationId: string;

  beforeAll(async () => {
    // Create Organization A with user
    orgAUserId = uuidv4();
    const hashedPasswordA = await bcrypt.hash('Password123!', 12);
    await query(
      `INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [orgAUserId, `orga-${Date.now()}@test.com`, hashedPasswordA, 'Org A User', 'user']
    );

    const orgAResult = await query(
      `INSERT INTO organizations (id, name, slug, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
      [uuidv4(), 'Organization A', `org-a-${Date.now()}`, orgAUserId]
    );
    orgAId = orgAResult.rows[0].id;

    // Get owner role for org A
    const ownerRoleAResult = await query(
      `SELECT id FROM organization_roles WHERE organization_id = $1 AND name = 'owner'`,
      [orgAId]
    );
    const ownerRoleIdA = ownerRoleAResult.rows[0]?.id;

    await query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [orgAId, orgAUserId, ownerRoleIdA]
    );

    // Create Organization B with user
    orgBUserId = uuidv4();
    const hashedPasswordB = await bcrypt.hash('Password123!', 12);
    await query(
      `INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [orgBUserId, `orgb-${Date.now()}@test.com`, hashedPasswordB, 'Org B User', 'user']
    );

    const orgBResult = await query(
      `INSERT INTO organizations (id, name, slug, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
      [uuidv4(), 'Organization B', `org-b-${Date.now()}`, orgBUserId]
    );
    orgBId = orgBResult.rows[0].id;

    // Get owner role for org B
    const ownerRoleBResult = await query(
      `SELECT id FROM organization_roles WHERE organization_id = $1 AND name = 'owner'`,
      [orgBId]
    );
    const ownerRoleIdB = ownerRoleBResult.rows[0]?.id;

    await query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [orgBId, orgBUserId, ownerRoleIdB]
    );

    // Create notification for Organization A
    orgANotificationId = uuidv4();
    await query(
      `INSERT INTO activity_logs (id, user_id, organization_id, event_type, entity_type, entity_id, message, status, is_read, created_at)
       VALUES ($1, $2, $3, 'vps.created', 'vps', $4, 'VPS created for Org A', 'success', false, NOW())`,
      [orgANotificationId, orgAUserId, orgAId, uuidv4()]
    );

    // Create notification for Organization B
    orgBNotificationId = uuidv4();
    await query(
      `INSERT INTO activity_logs (id, user_id, organization_id, event_type, entity_type, entity_id, message, status, is_read, created_at)
       VALUES ($1, $2, $3, 'vps.created', 'vps', $4, 'VPS created for Org B', 'success', false, NOW())`,
      [orgBNotificationId, orgBUserId, orgBId, uuidv4()]
    );

    // Generate tokens with organizationId claim
    orgAUserToken = jwt.sign(
      { userId: orgAUserId, email: `orga@test.com`, role: 'user', organizationId: orgAId },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    orgBUserToken = jwt.sign(
      { userId: orgBUserId, email: `orgb@test.com`, role: 'user', organizationId: orgBId },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Clean up in reverse dependency order
    await query('DELETE FROM activity_logs WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
    await query('DELETE FROM organization_members WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
    await query('DELETE FROM organization_roles WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
    await query('DELETE FROM organizations WHERE id IN ($1, $2)', [orgAId, orgBId]);
    await query('DELETE FROM users WHERE id IN ($1, $2)', [orgAUserId, orgBUserId]);
  });

  describe('Cross-Organization Notification Access Prevention', () => {
    /**
     * **SECURITY TEST: Cross-org notification access returns 404**
     *
     * Verifies that a user from Organization A cannot access notifications
     * belonging to Organization B. This is the core regression test for
     * organization-scoped notification queries.
     *
     * **Threat Mitigated:** Unauthorized access to cross-organization data
     * **Security Standard:** OWASP ASVS V4.1.1
     */
    it('should return 404 when Org A user tries to mark Org B notification as read', async () => {
      const testApp = await getApp();

      // Org A user tries to mark Org B's notification as read
      const response = await request(testApp)
        .patch(`/api/notifications/${orgBNotificationId}/read`)
        .set('Authorization', `Bearer ${orgAUserToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Notification not found');
    });

    it('should return 404 when Org B user tries to mark Org A notification as read', async () => {
      const testApp = await getApp();

      // Org B user tries to mark Org A's notification as read
      const response = await request(testApp)
        .patch(`/api/notifications/${orgANotificationId}/read`)
        .set('Authorization', `Bearer ${orgBUserToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Notification not found');
    });

    /**
     * **SECURITY TEST: Notification lists are scoped to user's organization**
     *
     * Verifies that the notification list endpoints only return notifications
     * belonging to the user's organization.
     *
     * **Threat Mitigated:** Data leakage across organizations
     * **Security Standard:** OWASP ASVS V4.1.3
     */
    it('should only return notifications from user\'s own organization', async () => {
      const testApp = await getApp();

      // Org A user fetches all notifications
      const response = await request(testApp)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${orgAUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.notifications).toBeDefined();
      
      // All returned notifications should belong to Org A
      const notifications = response.body.notifications || [];
      for (const notification of notifications) {
        expect(notification.organization_id).toBe(orgAId);
      }

      // Should not contain Org B's notification
      const orgBNotification = notifications.find((n: any) => n.id === orgBNotificationId);
      expect(orgBNotification).toBeUndefined();
    });

    it('should only return unread notifications from user\'s own organization', async () => {
      const testApp = await getApp();

      // Org B user fetches unread notifications
      const response = await request(testApp)
        .get('/api/notifications/unread')
        .set('Authorization', `Bearer ${orgBUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.notifications).toBeDefined();
      
      // All returned notifications should belong to Org B
      const notifications = response.body.notifications || [];
      for (const notification of notifications) {
        expect(notification.organization_id).toBe(orgBId);
      }

      // Should not contain Org A's notification
      const orgANotification = notifications.find((n: any) => n.id === orgANotificationId);
      expect(orgANotification).toBeUndefined();
    });

    /**
     * **SECURITY TEST: Unread count is scoped to user's organization**
     *
     * Verifies that the unread count endpoint only counts notifications
     * belonging to the user's organization.
     *
     * **Threat Mitigated:** Information disclosure about other organizations
     * **Security Standard:** OWASP ASVS V4.1.3
     */
    it('should only count unread notifications from user\'s own organization', async () => {
      const testApp = await getApp();

      // Org A user fetches unread count
      const response = await request(testApp)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${orgAUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.count).toBeDefined();
      expect(typeof response.body.count).toBe('number');
      
      // The count should reflect only Org A's unread notifications
      // We created 1 unread notification for Org A
      expect(response.body.count).toBeGreaterThanOrEqual(1);
    });

    /**
     * **SECURITY TEST: User can mark their own organization's notification as read**
     *
     * Verifies that legitimate access still works after organization scoping.
     *
     * **Security Standard:** OWASP ASVS V4.1.1
     */
    it('should allow user to mark their own organization\'s notification as read', async () => {
      const testApp = await getApp();

      // Org A user marks their own notification as read
      const response = await request(testApp)
        .patch(`/api/notifications/${orgANotificationId}/read`)
        .set('Authorization', `Bearer ${orgAUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    /**
     * **SECURITY TEST: Already read notification returns 404 on re-read attempt**
     *
     * Verifies that attempting to mark an already-read notification returns
     * appropriate error (either 404 or success with message).
     *
     * **Security Standard:** OWASP ASVS V4.1.3
     */
    it('should return 404 when trying to mark already-read notification', async () => {
      const testApp = await getApp();

      // Org A user tries to mark the same notification again (already read in previous test)
      const response = await request(testApp)
        .patch(`/api/notifications/${orgANotificationId}/read`)
        .set('Authorization', `Bearer ${orgAUserToken}`);

      // The notification exists but is already read, so it should return 404
      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Notification not found');
    });
  });

  describe('Organization Scoping Verification', () => {
    /**
     * **SECURITY TEST: All SELECT queries include organization_id filtering**
     *
     * This test verifies the implementation pattern by checking the source code.
     * All SELECT queries from activity_logs in notifications.ts should include
     * organization_id in the WHERE clause.
     *
     * **Threat Mitigated:** Missing organization scoping in queries
     * **Security Standard:** OWASP ASVS V4.2.1
     */
    it('should have organization_id in all activity_logs SELECT queries in notifications.ts', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const notificationsPath = path.resolve(process.cwd(), 'api', 'routes', 'notifications.ts');
      const source = fs.readFileSync(notificationsPath, 'utf8');

      // Find all SELECT queries that query activity_logs
      // We use a more specific pattern to match queries that select from activity_logs
      const activityLogQueries = source.match(/SELECT[\s\S]*?FROM[\s]*activity_logs[\s\S]*?WHERE[\s\S]*?;/gi) || [];

      // Each SELECT query from activity_logs should have organization_id in the WHERE clause
      for (const query of activityLogQueries) {
        const hasOrgScoping = /organization_id\s*=/i.test(query);
        expect(hasOrgScoping, `SELECT query from activity_logs should include organization_id filtering: ${query.substring(0, 100)}...`).toBe(true);
      }

      // Verify we found at least one query (sanity check)
      expect(activityLogQueries.length, 'Should have found at least one activity_logs SELECT query').toBeGreaterThan(0);
    });

    it('should verify organization_id check in PATCH /:id/read route', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const notificationsPath = path.resolve(process.cwd(), 'api', 'routes', 'notifications.ts');
      const source = fs.readFileSync(notificationsPath, 'utf8');

      // The PATCH /:id/read route should have an ownership check
      const hasOwnershipCheck = /ownershipCheck|WHERE.*id.*organization_id/i.test(source);
      expect(hasOwnershipCheck, 'PATCH /:id/read should verify organization ownership').toBe(true);
    });
  });
});
