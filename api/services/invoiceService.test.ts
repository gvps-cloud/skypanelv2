/**
 * Bug Condition Exploration Test for Invoice User & Organization Display
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**
 * 
 * This test verifies the bug condition exists on UNFIXED code.
 * EXPECTED OUTCOME: This test MUST FAIL (proving the bug exists)
 * 
 * The test checks that invoices generated with userId or organizationId
 * should display user name, email, organization ID, and organization name
 * in the HTML, but currently they do NOT (bug condition).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import { InvoiceService } from './invoiceService.js';
import { query } from '../lib/database.js';
import { v4 as uuidv4 } from 'uuid';

describe('Bug Condition Exploration: Invoice Missing User and Organization Display', () => {
  let testOrganizationId: string;
  let testUserId: string;
  let testUserName: string;
  let testUserEmail: string;
  let testOrgName: string;

  beforeAll(async () => {
    // Create test user first (needed as owner for organization)
    testUserName = 'John Doe';
    testUserEmail = `test-${Date.now()}@example.com`;
    const tempUserId = uuidv4();
    await query(
      `INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [tempUserId, testUserName, testUserEmail, '$2a$10$hashedpassword']
    );

    // Create test organization with required fields
    testOrgName = 'Test Organization Inc';
    const orgSlug = `test-org-${Date.now()}`;
    const orgResult = await query(
      `INSERT INTO organizations (id, name, slug, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id`,
      [uuidv4(), testOrgName, orgSlug, tempUserId]
    );
    testOrganizationId = orgResult.rows[0].id;

    // Update user with active_organization_id
    await query(
      `UPDATE users SET active_organization_id = $1 WHERE id = $2`,
      [testOrganizationId, tempUserId]
    );
    testUserId = tempUserId;
  });

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
    if (testOrganizationId) {
      await query('DELETE FROM organizations WHERE id = $1', [testOrganizationId]);
    }
  });

  it('Property 1: Bug Condition - Invoice Missing User and Organization Display', () => {
    /**
     * Scoped PBT Approach: Testing the concrete failing case
     * 
     * This property test verifies that when an invoice is generated with
     * userId and organizationId, the HTML SHOULD contain:
     * - User name
     * - User email
     * - Organization ID
     * - Organization name
     * 
     * EXPECTED: This test FAILS on unfixed code (bug exists)
     * AFTER FIX: This test PASSES (bug is fixed)
     */
    fc.assert(
      fc.property(
        // Generate test invoice data with known userId and organizationId
        fc.record({
          transactionAmount: fc.double({ min: 1, max: 1000, noNaN: true }),
          transactionDescription: fc.string({ minLength: 5, maxLength: 50 }),
        }),
        (testData) => {
          // Generate invoice from transaction with user/org data
          const invoiceData = InvoiceService.generateInvoiceFromTransactions(
            testOrganizationId,
            [
              {
                description: testData.transactionDescription,
                amount: testData.transactionAmount,
                currency: 'USD',
                createdAt: new Date().toISOString(),
              },
            ],
            `INV-TEST-${Date.now()}`,
            testUserId,
            testUserName,
            testUserEmail,
            testOrgName
          );

          // Generate HTML
          const htmlContent = InvoiceService.generateInvoiceHTML(invoiceData);

          // Parse HTML to verify user and organization information is displayed
          // BUG CONDITION: These assertions will FAIL because the data is missing

          // Check for user name in HTML
          const hasUserName = htmlContent.includes(testUserName);
          expect(hasUserName).toBe(true); // WILL FAIL - user name not in HTML

          // Check for user email in HTML
          const hasUserEmail = htmlContent.includes(testUserEmail);
          expect(hasUserEmail).toBe(true); // WILL FAIL - user email not in HTML

          // Check for organization ID in HTML
          const hasOrgId = htmlContent.includes(testOrganizationId);
          expect(hasOrgId).toBe(true); // WILL FAIL - org ID not in HTML

          // Check for organization name in HTML
          const hasOrgName = htmlContent.includes(testOrgName);
          expect(hasOrgName).toBe(true); // WILL FAIL - org name not in HTML

          // Additional check: Verify "Bill To" section exists
          const hasBillToSection = htmlContent.includes('Bill To') || htmlContent.includes('bill-to');
          expect(hasBillToSection).toBe(true); // WILL FAIL - no Bill To section

          return true;
        }
      ),
      { numRuns: 10 } // Run 10 times to ensure reproducibility
    );
  });

  it('Bug Condition - Invoice from Billing Cycles Missing Organization Display', () => {
    /**
     * Test invoice generation from billing cycles
     * Verifies organization information is missing in this flow as well
     */
    fc.assert(
      fc.property(
        fc.record({
          hoursCharged: fc.integer({ min: 1, max: 720 }),
          hourlyRate: fc.double({ min: 0.01, max: 1.0, noNaN: true }),
        }),
        (testData) => {
          // Generate invoice from billing cycles with user/org data
          const invoiceData = InvoiceService.generateInvoiceFromBillingCycles(
            testOrganizationId,
            [
              {
                vpsLabel: 'test-vps-01',
                billingPeriodStart: new Date('2024-01-01'),
                billingPeriodEnd: new Date('2024-01-31'),
                hoursCharged: testData.hoursCharged,
                baseHourlyRate: testData.hourlyRate,
                backupHourlyRate: 0,
                backupFrequency: 'none',
                totalAmount: testData.hoursCharged * testData.hourlyRate,
              },
            ],
            `INV-VPS-TEST-${Date.now()}`,
            'USD',
            testUserId,
            testUserName,
            testUserEmail,
            testOrgName
          );

          // Generate HTML
          const htmlContent = InvoiceService.generateInvoiceHTML(invoiceData);

          // Verify organization and user information is displayed
          const hasUserName = htmlContent.includes(testUserName);
          expect(hasUserName).toBe(true); // WILL FAIL

          const hasUserEmail = htmlContent.includes(testUserEmail);
          expect(hasUserEmail).toBe(true); // WILL FAIL

          const hasOrgId = htmlContent.includes(testOrganizationId);
          expect(hasOrgId).toBe(true); // WILL FAIL

          const hasOrgName = htmlContent.includes(testOrgName);
          expect(hasOrgName).toBe(true); // WILL FAIL

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });


});

/**
 * Preservation Property Tests for Invoice Functionality
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 * 
 * These tests verify that existing invoice functionality remains unchanged
 * after implementing the fix for user/organization display.
 * 
 * EXPECTED OUTCOME: These tests MUST PASS on UNFIXED code (baseline behavior)
 * AFTER FIX: These tests MUST STILL PASS (no regressions)
 */

describe('Preservation Property Tests: Existing Invoice Functionality', () => {
  let testOrganizationId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Create test user
    const tempUserId = uuidv4();
    await query(
      `INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [tempUserId, 'Preservation Test User', `preservation-${Date.now()}@example.com`, '$2a$10$hashedpassword']
    );

    // Create test organization
    const orgSlug = `preservation-org-${Date.now()}`;
    const orgResult = await query(
      `INSERT INTO organizations (id, name, slug, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id`,
      [uuidv4(), 'Preservation Test Org', orgSlug, tempUserId]
    );
    testOrganizationId = orgResult.rows[0].id;

    // Update user with active_organization_id
    await query(
      `UPDATE users SET active_organization_id = $1 WHERE id = $2`,
      [testOrganizationId, tempUserId]
    );
    testUserId = tempUserId;
  });

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
    if (testOrganizationId) {
      await query('DELETE FROM organizations WHERE id = $1', [testOrganizationId]);
    }
  });

  it('Property 2.1: Preservation - Invoice Calculation Logic Remains Unchanged', () => {
    /**
     * Validates: Requirements 3.2
     * 
     * This property verifies that invoice calculations (subtotal, tax, total)
     * remain correct regardless of user/org data presence.
     */
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            amount: fc.double({ min: 0.01, max: 1000, noNaN: true }),
            description: fc.string({ minLength: 5, maxLength: 50 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (transactions) => {
          // Generate invoice from transactions
          const invoiceData = InvoiceService.generateInvoiceFromTransactions(
            testOrganizationId,
            transactions.map(t => ({
              description: t.description,
              amount: t.amount,
              currency: 'USD',
              createdAt: new Date().toISOString(),
            })),
            `INV-CALC-${Date.now()}`,
            testUserId
          );

          // Verify calculations are correct
          const expectedSubtotal = transactions.reduce((sum, t) => sum + t.amount, 0);
          const expectedTax = 0; // No tax for wallet transactions
          const expectedTotal = expectedSubtotal + expectedTax;

          // Allow small floating point differences
          const subtotalMatch = Math.abs(invoiceData.subtotal - expectedSubtotal) < 0.01;
          const taxMatch = Math.abs(invoiceData.tax - expectedTax) < 0.01;
          const totalMatch = Math.abs(invoiceData.total - expectedTotal) < 0.01;

          expect(subtotalMatch).toBe(true);
          expect(taxMatch).toBe(true);
          expect(totalMatch).toBe(true);

          // Verify items match transactions
          expect(invoiceData.items.length).toBe(transactions.length);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 2.2: Preservation - Invoice Storage in Database Works Correctly', async () => {
    /**
     * Validates: Requirements 3.4
     * 
     * This property verifies that invoices are stored in billing_invoices table
     * with correct structure and data.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          amount: fc.double({ min: 1, max: 500, noNaN: true }),
          invoiceNumber: fc.string({ minLength: 5, maxLength: 20 }),
        }),
        async (testData) => {
          // Generate invoice
          const invoiceData = InvoiceService.generateInvoiceFromTransactions(
            testOrganizationId,
            [
              {
                description: 'Storage Test Transaction',
                amount: testData.amount,
                currency: 'USD',
                createdAt: new Date().toISOString(),
              },
            ],
            testData.invoiceNumber,
            testUserId
          );

          // Generate HTML
          const htmlContent = InvoiceService.generateInvoiceHTML(invoiceData);

          // Store invoice
          const invoiceId = await InvoiceService.createInvoice(
            testOrganizationId,
            testData.invoiceNumber,
            htmlContent,
            { test: true },
            testData.amount,
            'USD'
          );

          // Verify invoice was stored
          expect(invoiceId).toBeTruthy();

          // Retrieve invoice
          const retrievedInvoice = await InvoiceService.getInvoice(invoiceId, testOrganizationId);

          // Verify stored data
          expect(retrievedInvoice).toBeTruthy();
          expect(retrievedInvoice?.invoiceNumber).toBe(testData.invoiceNumber);
          expect(retrievedInvoice?.organizationId).toBe(testOrganizationId);
          expect(Math.abs(retrievedInvoice!.totalAmount - testData.amount)).toBeLessThan(0.01);
          expect(retrievedInvoice?.currency).toBe('USD');
          expect(retrievedInvoice?.htmlContent).toBe(htmlContent);

          // Clean up
          await query('DELETE FROM billing_invoices WHERE id = $1', [invoiceId]);

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 2.3: Preservation - Invoice HTML Structure and Styling Remain Unchanged', () => {
    /**
     * Validates: Requirements 3.3, 3.5
     * 
     * This property verifies that invoice HTML structure, styling, and theme colors
     * remain unchanged. Tests that HTML is printable and maintains proper formatting.
     */
    fc.assert(
      fc.property(
        fc.record({
          amount: fc.double({ min: 1, max: 1000, noNaN: true }),
          description: fc.string({ minLength: 5, maxLength: 50 }),
        }),
        (testData) => {
          // Generate invoice
          const invoiceData = InvoiceService.generateInvoiceFromTransactions(
            testOrganizationId,
            [
              {
                description: testData.description,
                amount: testData.amount,
                currency: 'USD',
                createdAt: new Date().toISOString(),
              },
            ],
            `INV-STYLE-${Date.now()}`,
            testUserId
          );

          // Generate HTML
          const htmlContent = InvoiceService.generateInvoiceHTML(invoiceData);

          // Verify HTML structure elements are present
          expect(htmlContent).toContain('<!DOCTYPE html>');
          expect(htmlContent).toContain('<html lang="en">');
          expect(htmlContent).toContain('<head>');
          expect(htmlContent).toContain('<body>');
          expect(htmlContent).toContain('<style>');

          // Verify key structural elements
          expect(htmlContent).toContain('class="container"');
          expect(htmlContent).toContain('class="header"');
          expect(htmlContent).toContain('class="invoice-meta"');
          expect(htmlContent).toContain('<table>');
          expect(htmlContent).toContain('<thead>');
          expect(htmlContent).toContain('<tbody>');
          expect(htmlContent).toContain('class="totals"');
          expect(htmlContent).toContain('class="footer"');

          // Verify invoice metadata is displayed
          expect(htmlContent).toContain('Invoice Date');
          expect(htmlContent).toContain('Invoice Status');
          expect(htmlContent).toContain(invoiceData.invoiceNumber);

          // Verify table headers
          expect(htmlContent).toContain('Description');
          expect(htmlContent).toContain('Quantity');
          expect(htmlContent).toContain('Unit Price');
          expect(htmlContent).toContain('Amount');

          // Verify totals section
          expect(htmlContent).toContain('Subtotal:');
          expect(htmlContent).toContain('Total:');
          expect(htmlContent).toContain(invoiceData.total.toFixed(4));

          // Verify status badge
          expect(htmlContent).toContain('class="status-badge');
          expect(htmlContent).toContain(invoiceData.status.toUpperCase());

          // Verify print media query exists
          expect(htmlContent).toContain('@media print');

          // Verify theme colors are applied (check for color styles)
          expect(htmlContent).toContain('color:');
          expect(htmlContent).toContain('background:');

          return true;
        }
      ),
      { numRuns: 15 }
    );
  });

  it('Property 2.4: Preservation - Invoice Items Display and Formatting Remain Unchanged', () => {
    /**
     * Validates: Requirements 3.2
     * 
     * This property verifies that invoice items are displayed correctly
     * with proper formatting for description, quantity, unit price, and amount.
     */
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            description: fc.string({ minLength: 5, maxLength: 50 }),
            amount: fc.double({ min: 0.01, max: 500, noNaN: true }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (items) => {
          // Generate invoice
          const invoiceData = InvoiceService.generateInvoiceFromTransactions(
            testOrganizationId,
            items.map(item => ({
              description: item.description,
              amount: item.amount,
              currency: 'USD',
              createdAt: new Date().toISOString(),
            })),
            `INV-ITEMS-${Date.now()}`,
            testUserId
          );

          // Generate HTML
          const htmlContent = InvoiceService.generateInvoiceHTML(invoiceData);

          // Verify each item is displayed in HTML
          items.forEach(item => {
            expect(htmlContent).toContain(item.description);
            expect(htmlContent).toContain(item.amount.toFixed(4));
          });

          // Verify item count matches
          expect(invoiceData.items.length).toBe(items.length);

          // Verify each invoice item has required fields
          invoiceData.items.forEach(item => {
            expect(item.description).toBeTruthy();
            expect(item.quantity).toBeGreaterThan(0);
            expect(item.unitPrice).toBeGreaterThanOrEqual(0);
            expect(item.amount).toBeGreaterThanOrEqual(0);
          });

          return true;
        }
      ),
      { numRuns: 15 }
    );
  });

  it('Property 2.5: Preservation - Invoice Generation Without userId Continues to Work', () => {
    /**
     * Validates: Requirements 3.1, 3.6
     * 
     * This property verifies that invoices can be generated without userId
     * and the system does not crash or error.
     */
    fc.assert(
      fc.property(
        fc.record({
          amount: fc.double({ min: 1, max: 1000, noNaN: true }),
          description: fc.string({ minLength: 5, maxLength: 50 }),
        }),
        (testData) => {
          // Generate invoice WITHOUT userId
          const invoiceData = InvoiceService.generateInvoiceFromTransactions(
            testOrganizationId,
            [
              {
                description: testData.description,
                amount: testData.amount,
                currency: 'USD',
                createdAt: new Date().toISOString(),
              },
            ],
            `INV-NO-USER-${Date.now()}`
            // Note: userId parameter is omitted
          );

          // Verify invoice was generated successfully
          expect(invoiceData).toBeTruthy();
          expect(invoiceData.organizationId).toBe(testOrganizationId);
          expect(invoiceData.userId).toBeUndefined();

          // Generate HTML - should not crash
          const htmlContent = InvoiceService.generateInvoiceHTML(invoiceData);

          // Verify HTML was generated
          expect(htmlContent).toBeTruthy();
          expect(htmlContent).toContain('<!DOCTYPE html>');
          expect(htmlContent).toContain(invoiceData.invoiceNumber);

          // Verify calculations are correct
          expect(invoiceData.subtotal).toBeCloseTo(testData.amount, 2);
          expect(invoiceData.total).toBeCloseTo(testData.amount, 2);

          return true;
        }
      ),
      { numRuns: 15 }
    );
  });

  it('Property 2.6: Preservation - VPS Billing Cycles Invoice Generation Works Correctly', () => {
    /**
     * Validates: Requirements 3.2, 3.3, 3.4
     * 
     * This property verifies that invoice generation from VPS billing cycles
     * continues to work correctly with proper calculations and formatting.
     */
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            hoursCharged: fc.integer({ min: 1, max: 720 }),
            baseHourlyRate: fc.double({ min: 0.01, max: 1.0, noNaN: true }),
            backupHourlyRate: fc.double({ min: 0, max: 0.1, noNaN: true }),
            vpsLabel: fc.string({ minLength: 5, maxLength: 20 }),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        (cycles) => {
          // Generate invoice from billing cycles
          const invoiceData = InvoiceService.generateInvoiceFromBillingCycles(
            testOrganizationId,
            cycles.map(cycle => ({
              vpsLabel: cycle.vpsLabel,
              billingPeriodStart: new Date('2024-01-01'),
              billingPeriodEnd: new Date('2024-01-31'),
              hoursCharged: cycle.hoursCharged,
              baseHourlyRate: cycle.baseHourlyRate,
              backupHourlyRate: cycle.backupHourlyRate,
              backupFrequency: cycle.backupHourlyRate > 0 ? 'daily' : 'none',
              totalAmount: cycle.hoursCharged * (cycle.baseHourlyRate + cycle.backupHourlyRate),
            })),
            `INV-VPS-PRESERVE-${Date.now()}`,
            'USD',
            testUserId
          );

          // Verify invoice structure
          expect(invoiceData).toBeTruthy();
          expect(invoiceData.organizationId).toBe(testOrganizationId);
          expect(invoiceData.title).toBe('VPS Billing Statement');

          // Verify calculations
          let expectedSubtotal = 0;
          cycles.forEach(cycle => {
            expectedSubtotal += cycle.hoursCharged * cycle.baseHourlyRate;
            if (cycle.backupHourlyRate > 0) {
              expectedSubtotal += cycle.hoursCharged * cycle.backupHourlyRate;
            }
          });

          expect(Math.abs(invoiceData.subtotal - expectedSubtotal)).toBeLessThan(0.01);
          expect(invoiceData.tax).toBe(0);
          expect(Math.abs(invoiceData.total - expectedSubtotal)).toBeLessThan(0.01);

          // Generate HTML
          const htmlContent = InvoiceService.generateInvoiceHTML(invoiceData);

          // Verify HTML contains VPS labels
          cycles.forEach(cycle => {
            expect(htmlContent).toContain(cycle.vpsLabel);
          });

          // Verify HTML structure is intact
          expect(htmlContent).toContain('VPS Billing Statement');
          expect(htmlContent).toContain('<!DOCTYPE html>');

          return true;
        }
      ),
      { numRuns: 15 }
    );
  });

  it('Property 2.7: Preservation - Invoice Listing and Retrieval Endpoints Continue to Function', async () => {
    /**
     * Validates: Requirements 3.4
     * 
     * This property verifies that invoice listing and retrieval operations
     * continue to work correctly after the fix.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            amount: fc.double({ min: 1, max: 500, noNaN: true }),
            invoiceNumber: fc.string({ minLength: 5, maxLength: 20 }),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (testInvoices) => {
          const createdInvoiceIds: string[] = [];

          try {
            // Create multiple invoices
            for (const testInvoice of testInvoices) {
              const invoiceData = InvoiceService.generateInvoiceFromTransactions(
                testOrganizationId,
                [
                  {
                    description: 'Listing Test Transaction',
                    amount: testInvoice.amount,
                    currency: 'USD',
                    createdAt: new Date().toISOString(),
                  },
                ],
                testInvoice.invoiceNumber,
                testUserId
              );

              const htmlContent = InvoiceService.generateInvoiceHTML(invoiceData);
              const invoiceId = await InvoiceService.createInvoice(
                testOrganizationId,
                testInvoice.invoiceNumber,
                htmlContent,
                { test: true },
                testInvoice.amount,
                'USD'
              );

              createdInvoiceIds.push(invoiceId);
            }

            // List invoices for organization
            const listedInvoices = await InvoiceService.listInvoices(testOrganizationId, 50, 0);

            // Verify listing works
            expect(listedInvoices).toBeTruthy();
            expect(Array.isArray(listedInvoices)).toBe(true);
            expect(listedInvoices.length).toBeGreaterThanOrEqual(testInvoices.length);

            // Verify each created invoice can be retrieved
            for (const invoiceId of createdInvoiceIds) {
              const retrievedInvoice = await InvoiceService.getInvoice(invoiceId, testOrganizationId);
              expect(retrievedInvoice).toBeTruthy();
              expect(retrievedInvoice?.id).toBe(invoiceId);
              expect(retrievedInvoice?.organizationId).toBe(testOrganizationId);
            }

            return true;
          } finally {
            // Clean up
            for (const invoiceId of createdInvoiceIds) {
              await query('DELETE FROM billing_invoices WHERE id = $1', [invoiceId]);
            }
          }
        }
      ),
      { numRuns: 5 } // Fewer runs due to database operations
    );
  });
});
