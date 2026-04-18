/**
 * SECURITY TEST: Payment Isolation
 *
 * **Validates: Requirements 1.3**
 *
 * This test verifies that payment data is properly isolated between organizations,
 * preventing cross-organization access to PayPal orders, wallet balances, and invoices.
 *
 * **Test Coverage:**
 * - User A's token cannot capture User B's PayPal order
 * - User A's token cannot view User B's wallet balance
 * - User A's token cannot view User B's invoices
 * - PayPal service is mocked — no real sandbox calls
 *
 * **Security Principles Verified:**
 * 1. Payment operations are scoped to organizations
 * 2. Cross-organization payment access is prevented
 * 3. Order ownership is verified before capture
 * 4. Wallet data is isolated by organization
 * 5. Invoice data is isolated by organization
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

// Mock PayPal service to avoid real API calls
vi.mock('../../api/services/paypalService.js', () => ({
  PayPalService: {
    createPayment: vi.fn().mockResolvedValue({
      success: true,
      paymentId: 'test-payment-id',
      approvalUrl: 'https://test.approval.url',
    }),
    capturePayment: vi.fn().mockResolvedValue({
      success: true,
      paymentId: 'test-payment-id',
    }),
    getWalletBalance: vi.fn().mockImplementation(async (orgId: string) => {
      // Return different balances based on organization
      const result = await query(
        'SELECT balance FROM wallets WHERE organization_id = $1',
        [orgId]
      );
      return result.rows.length > 0 ? result.rows[0].balance : 0;
    }),
    getWalletTransactions: vi.fn().mockResolvedValue([]),
    deductFundsFromWallet: vi.fn().mockResolvedValue(true),
    createPayout: vi.fn().mockResolvedValue({
      success: true,
      paymentId: 'test-payout-id',
    }),
  },
}));

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

// Mock theme service
vi.mock('../../api/services/themeService.js', () => ({
  themeService: {
    getThemeConfig: vi.fn().mockResolvedValue({}),
  },
  resolveThemePalette: vi.fn().mockReturnValue({
    primary: '#3b82f6',
    secondary: '#64748b',
  }),
}));

// Mock InvoiceService
vi.mock('../../api/services/invoiceService.js', () => ({
  InvoiceService: {
    listInvoices: vi.fn().mockImplementation(async (orgId: string) => {
      const result = await query(
        'SELECT * FROM billing_invoices WHERE organization_id = $1 ORDER BY created_at DESC',
        [orgId]
      );
      return result.rows;
    }),
    getInvoice: vi.fn().mockImplementation(async (id: string, orgId: string) => {
      const result = await query(
        'SELECT * FROM billing_invoices WHERE id = $1 AND organization_id = $2',
        [id, orgId]
      );
      return result.rows.length > 0 ? result.rows[0] : null;
    }),
  },
}));

// Mock EgressBillingService
vi.mock('../../api/services/egressBillingService.js', () => ({
  EgressBillingService: {
    listInvoiceItemsForPeriod: vi.fn().mockResolvedValue([]),
  },
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

describe('Payment Isolation', () => {
  // Organization A
  let orgAUserId: string;
  let orgAUserToken: string;
  let orgAId: string;
  let orgAOrderId: string;
  let orgAInvoiceId: string;

  // Organization B
  let orgBUserId: string;
  let orgBUserToken: string;
  let orgBId: string;
  let orgBOrderId: string;
  let orgBInvoiceId: string;

  beforeAll(async () => {
    // Create Organization A with user
    orgAUserId = uuidv4();
    const hashedPasswordA = await bcrypt.hash('Password123!', 12);
    await query(
      `INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [orgAUserId, `orga-payment-${Date.now()}@test.com`, hashedPasswordA, 'Org A Payment User', 'user']
    );

    const orgAResult = await query(
      `INSERT INTO organizations (id, name, slug, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
      [uuidv4(), 'Payment Org A', `payment-org-a-${Date.now()}`, orgAUserId]
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

    // Create wallet for Org A with balance
    await query(
      `INSERT INTO wallets (organization_id, balance, currency, created_at, updated_at)
       VALUES ($1, 100.00, 'USD', NOW(), NOW())`,
      [orgAId]
    );

    // Create payment transaction (order) for Org A
    orgAOrderId = uuidv4();
    await query(
      `INSERT INTO payment_transactions (id, organization_id, amount, currency, payment_method, description, status, payment_provider, created_at, updated_at)
       VALUES ($1, $2, 50.00, 'USD', 'paypal', 'Test payment for Org A', 'completed', 'paypal', NOW(), NOW())`,
      [orgAOrderId, orgAId]
    );

    // Create invoice for Org A (using billing_invoices table)
    orgAInvoiceId = uuidv4();
    await query(
      `INSERT INTO billing_invoices (id, organization_id, invoice_number, html_content, data, total_amount, currency, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [orgAInvoiceId, orgAId, `INV-A-${Date.now()}`, '<html>Invoice A</html>', '{}', 50.00, 'USD']
    );

    // Create Organization B with user
    orgBUserId = uuidv4();
    const hashedPasswordB = await bcrypt.hash('Password123!', 12);
    await query(
      `INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [orgBUserId, `orgb-payment-${Date.now()}@test.com`, hashedPasswordB, 'Org B Payment User', 'user']
    );

    const orgBResult = await query(
      `INSERT INTO organizations (id, name, slug, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
      [uuidv4(), 'Payment Org B', `payment-org-b-${Date.now()}`, orgBUserId]
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

    // Create wallet for Org B with different balance
    await query(
      `INSERT INTO wallets (organization_id, balance, currency, created_at, updated_at)
       VALUES ($1, 200.00, 'USD', NOW(), NOW())`,
      [orgBId]
    );

    // Create payment transaction (order) for Org B
    orgBOrderId = uuidv4();
    await query(
      `INSERT INTO payment_transactions (id, organization_id, amount, currency, payment_method, description, status, payment_provider, created_at, updated_at)
       VALUES ($1, $2, 75.00, 'USD', 'paypal', 'Test payment for Org B', 'completed', 'paypal', NOW(), NOW())`,
      [orgBOrderId, orgBId]
    );

    // Create invoice for Org B (using billing_invoices table)
    orgBInvoiceId = uuidv4();
    await query(
      `INSERT INTO billing_invoices (id, organization_id, invoice_number, html_content, data, total_amount, currency, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [orgBInvoiceId, orgBId, `INV-B-${Date.now()}`, '<html>Invoice B</html>', '{}', 75.00, 'USD']
    );

    // Generate tokens with organizationId claim
    orgAUserToken = jwt.sign(
      { userId: orgAUserId, email: `orga-payment@test.com`, role: 'user', organizationId: orgAId },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    orgBUserToken = jwt.sign(
      { userId: orgBUserId, email: `orgb-payment@test.com`, role: 'user', organizationId: orgBId },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Clean up in reverse dependency order
    await query('DELETE FROM billing_invoices WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
    await query('DELETE FROM payment_transactions WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
    await query('DELETE FROM wallets WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
    await query('DELETE FROM organization_members WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
    await query('DELETE FROM organization_roles WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
    await query('DELETE FROM organizations WHERE id IN ($1, $2)', [orgAId, orgBId]);
    await query('DELETE FROM users WHERE id IN ($1, $2)', [orgAUserId, orgBUserId]);
  });

  describe('PayPal Order Capture Isolation', () => {
    /**
     * **SECURITY TEST: Cross-org order capture is prevented**
     *
     * Verifies that a user from Organization A cannot capture a PayPal order
     * belonging to Organization B. The order ownership is verified before capture.
     *
     * **Threat Mitigated:** Unauthorized payment capture
     * **Security Standard:** OWASP ASVS V4.1.1
     */
    it('should prevent Org A user from capturing Org B order', async () => {
      const testApp = await getApp();

      // Org A user tries to capture Org B's order
      const response = await request(testApp)
        .post(`/api/payments/capture-payment/${orgBOrderId}`)
        .set('Authorization', `Bearer ${orgAUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Unauthorized');
    });

    it('should prevent Org B user from capturing Org A order', async () => {
      const testApp = await getApp();

      // Org B user tries to capture Org A's order
      const response = await request(testApp)
        .post(`/api/payments/capture-payment/${orgAOrderId}`)
        .set('Authorization', `Bearer ${orgBUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Unauthorized');
    });

    /**
     * **SECURITY TEST: Legitimate order capture still works**
     *
     * Verifies that a user can capture their own organization's order
     * after the isolation checks are in place.
     *
     * Note: Since 'pending' status was removed, we test with 'completed' orders.
     * The capture endpoint should return 400 for already-captured orders,
     * but NOT 403 (authorization error).
     *
     * **Security Standard:** OWASP ASVS V4.1.1
     */
    it('should allow Org A user to capture their own order (returns 400 for already captured)', async () => {
      const testApp = await getApp();

      const response = await request(testApp)
        .post(`/api/payments/capture-payment/${orgAOrderId}`)
        .set('Authorization', `Bearer ${orgAUserToken}`);

      // Should NOT fail with 403 (authorization) or 404 (not found)
      // 400 is expected for already-captured orders
      expect(response.status).not.toBe(403);
      expect(response.status).not.toBe(404);
      // Expect 400 for already captured
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already');
    });

    it('should return 404 for non-existent order', async () => {
      const testApp = await getApp();

      const fakeOrderId = uuidv4();
      const response = await request(testApp)
        .post(`/api/payments/capture-payment/${fakeOrderId}`)
        .set('Authorization', `Bearer ${orgAUserToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('Wallet Balance Isolation', () => {
    /**
     * **SECURITY TEST: Wallet balance is scoped to user's organization**
     *
     * Verifies that the wallet balance endpoint returns only the balance
     * for the authenticated user's organization, not other organizations.
     *
     * **Threat Mitigated:** Cross-organization financial data leakage
     * **Security Standard:** OWASP ASVS V4.1.3
     */
    it('should return Org A wallet balance for Org A user', async () => {
      const testApp = await getApp();

      const response = await request(testApp)
        .get('/api/payments/wallet/balance')
        .set('Authorization', `Bearer ${orgAUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Balance is returned as string from database, parse for comparison
      expect(parseFloat(response.body.balance)).toBe(100.00);
    });

    it('should return Org B wallet balance for Org B user', async () => {
      const testApp = await getApp();

      const response = await request(testApp)
        .get('/api/payments/wallet/balance')
        .set('Authorization', `Bearer ${orgBUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Balance is returned as string from database, parse for comparison
      expect(parseFloat(response.body.balance)).toBe(200.00);
    });

    /**
     * **SECURITY TEST: Wallet balance cannot be accessed via header manipulation**
     *
     * Verifies that even if a malicious user tries to set a different organization ID
     * in headers, they still get their own organization's data.
     *
     * **Threat Mitigated:** Authorization bypass via header manipulation
     * **Security Standard:** OWASP ASVS V4.1.2
     */
    it('should ignore X-Organization-ID header and use token organization', async () => {
      const testApp = await getApp();

      // Org A user tries to access Org B's wallet by setting X-Organization-ID header
      const response = await request(testApp)
        .get('/api/payments/wallet/balance')
        .set('Authorization', `Bearer ${orgAUserToken}`)
        .set('X-Organization-ID', orgBId);

      // Should return Org A's balance (from token), not Org B's
      expect(response.status).toBe(200);
      // Balance is returned as string from database, parse for comparison
      expect(parseFloat(response.body.balance)).toBe(100.00);
    });
  });

  describe('Invoice Access Isolation', () => {
    /**
     * **SECURITY TEST: Cross-org invoice access returns 404**
     *
     * Verifies that a user from Organization A cannot access invoices
     * belonging to Organization B.
     *
     * **Threat Mitigated:** Unauthorized access to billing documents
     * **Security Standard:** OWASP ASVS V4.1.1
     */
    it('should prevent Org A user from viewing Org B invoice', async () => {
      const testApp = await getApp();

      const response = await request(testApp)
        .get(`/api/invoices/${orgBInvoiceId}`)
        .set('Authorization', `Bearer ${orgAUserToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should prevent Org B user from viewing Org A invoice', async () => {
      const testApp = await getApp();

      const response = await request(testApp)
        .get(`/api/invoices/${orgAInvoiceId}`)
        .set('Authorization', `Bearer ${orgBUserToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    /**
     * **SECURITY TEST: Legitimate invoice access still works**
     *
     * Verifies that a user can access their own organization's invoices.
     *
     * **Security Standard:** OWASP ASVS V4.1.1
     */
    it('should allow Org A user to view their own invoice', async () => {
      const testApp = await getApp();

      const response = await request(testApp)
        .get(`/api/invoices/${orgAInvoiceId}`)
        .set('Authorization', `Bearer ${orgAUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.invoice).toBeDefined();
    });

    it('should allow Org B user to view their own invoice', async () => {
      const testApp = await getApp();

      const response = await request(testApp)
        .get(`/api/invoices/${orgBInvoiceId}`)
        .set('Authorization', `Bearer ${orgBUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.invoice).toBeDefined();
    });

    /**
     * **SECURITY TEST: Invoice list is scoped to user's organization**
     *
     * Verifies that the invoice list endpoint only returns invoices
     * belonging to the user's organization.
     *
     * **Threat Mitigated:** Data leakage across organizations
     * **Security Standard:** OWASP ASVS V4.1.3
     */
    it('should only list invoices from user own organization', async () => {
      const testApp = await getApp();

      const response = await request(testApp)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${orgAUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.invoices).toBeDefined();

      // All invoices should belong to Org A
      const invoices = response.body.invoices || [];
      for (const invoice of invoices) {
        expect(invoice.organization_id).toBe(orgAId);
      }

      // Should not contain Org B's invoice
      const orgBInvoice = invoices.find((i: any) => i.id === orgBInvoiceId);
      expect(orgBInvoice).toBeUndefined();
    });

    it('should only list invoices from Org B for Org B user', async () => {
      const testApp = await getApp();

      const response = await request(testApp)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${orgBUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.invoices).toBeDefined();

      // All invoices should belong to Org B
      const invoices = response.body.invoices || [];
      for (const invoice of invoices) {
        expect(invoice.organization_id).toBe(orgBId);
      }

      // Should not contain Org A's invoice
      const orgAInvoice = invoices.find((i: any) => i.id === orgAInvoiceId);
      expect(orgAInvoice).toBeUndefined();
    });
  });

  describe('Payment Transaction Isolation', () => {
    /**
     * **SECURITY TEST: Payment transaction access is scoped to organization**
     *
     * Verifies that the payment transaction endpoint only returns transactions
     * belonging to the user's organization.
     *
     * **Threat Mitigated:** Cross-organization financial data leakage
     * **Security Standard:** OWASP ASVS V4.1.3
     */
    it('should prevent Org A user from viewing Org B transaction', async () => {
      const testApp = await getApp();

      const response = await request(testApp)
        .get(`/api/payments/transactions/${orgBOrderId}`)
        .set('Authorization', `Bearer ${orgAUserToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should prevent Org B user from viewing Org A transaction', async () => {
      const testApp = await getApp();

      const response = await request(testApp)
        .get(`/api/payments/transactions/${orgAOrderId}`)
        .set('Authorization', `Bearer ${orgBUserToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should allow Org A user to view their own transaction', async () => {
      const testApp = await getApp();

      const response = await request(testApp)
        .get(`/api/payments/transactions/${orgAOrderId}`)
        .set('Authorization', `Bearer ${orgAUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.transaction).toBeDefined();
    });
  });

  describe('Payment History Isolation', () => {
    /**
     * **SECURITY TEST: Payment history is scoped to user's organization**
     *
     * Verifies that the payment history endpoint only returns payments
     * belonging to the user's organization.
     *
     * **Threat Mitigated:** Data leakage across organizations
     * **Security Standard:** OWASP ASVS V4.1.3
     */
    it('should only list payments from user own organization', async () => {
      const testApp = await getApp();

      const response = await request(testApp)
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${orgAUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.payments).toBeDefined();

      // All payments should belong to Org A
      const payments = response.body.payments || [];
      for (const payment of payments) {
        expect(payment.organization_id).toBe(orgAId);
      }

      // Should not contain Org B's payment
      const orgBPayment = payments.find((p: any) => p.id === orgBOrderId);
      expect(orgBPayment).toBeUndefined();
    });

    it('should only list payments from Org B for Org B user', async () => {
      const testApp = await getApp();

      const response = await request(testApp)
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${orgBUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.payments).toBeDefined();

      // All payments should belong to Org B
      const payments = response.body.payments || [];
      for (const payment of payments) {
        expect(payment.organization_id).toBe(orgBId);
      }

      // Should not contain Org A's payment
      const orgAPayment = payments.find((p: any) => p.id === orgAOrderId);
      expect(orgAPayment).toBeUndefined();
    });
  });
});
