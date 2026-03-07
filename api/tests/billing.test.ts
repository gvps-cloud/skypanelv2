import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { query } from '../lib/database.js';

// Mock auth middleware
vi.mock('../middleware/auth.js', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'admin-id', role: 'admin', organizationId: 'org-id' };
    next();
  },
  requireAdmin: (req: any, res: any, next: any) => next(),
  requireOrganization: (req: any, res: any, next: any) => next(),
  optionalAuth: (req: any, res: any, next: any) => next(),
  requireUser: (req: any, res: any, next: any) => next(),
}));

// Mock database
vi.mock('../lib/database.js', () => ({
  query: vi.fn(),
}));

// Mock services
vi.mock('../services/paypalService.js', () => ({
  PayPalService: {},
}));
vi.mock('../services/activityLogger.js', () => ({
  logActivity: vi.fn(),
}));
vi.mock('../services/billingCronService.js', () => ({
  BillingCronService: { start: vi.fn() },
}));
vi.mock('../services/rateLimitMetrics.js', () => ({
  initializeMetricsCollection: vi.fn(),
  startMetricsPersistence: vi.fn(),
  recordRateLimitEvent: vi.fn(),
}));

describe('Admin Billing API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/admin/billing/stats returns stats', async () => {
    const mockQuery = query as any;
    
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '1000' }] }) 
      .mockResolvedValueOnce({ rows: [{ total: '500' }] }) 
      .mockResolvedValueOnce({ rows: [{ total: '10' }] }) 
      .mockResolvedValueOnce({ rows: [{ total: '2' }] }) 
      .mockResolvedValueOnce({ rows: [{ month: '2023-01', total: '100' }] }); 

    const res = await request(app).get('/api/admin/billing/stats');
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats.totalRevenue).toBe(1000);
  });

  it('GET /api/admin/billing/users returns user list', async () => {
    const mockQuery = query as any;
    
    mockQuery
      .mockResolvedValueOnce({ 
        rows: [{ 
          id: 'u1', 
          name: 'User 1', 
          email: 'u1@test.com', 
          balance: '50.00',
          active_services: '1',
          created_at: new Date().toISOString()
        }] 
      }) 
      .mockResolvedValueOnce({ rows: [{ total: '1' }] });

    const res = await request(app).get('/api/admin/billing/users');
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.users).toHaveLength(1);
  });

  it('POST /api/admin/billing/transactions creates manual adjustment', async () => {
    const mockQuery = query as any;
    const userId = '550e8400-e29b-41d4-a716-446655440000'; // Valid UUID

    // Mock sequence:
    // 1. Get organization ID for user
    // 2. Update wallet balance
    // 3. Insert transaction
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'org-1' }] }) // Get Org
      .mockResolvedValueOnce({ rows: [{ balance: '100.00' }] }) // Update Wallet
      .mockResolvedValueOnce({ rows: [{ id: 'tx-1' }] }); // Insert Tx

    const res = await request(app)
      .post('/api/admin/billing/transactions')
      .send({
        userId,
        amount: 50,
        type: 'credit',
        description: 'Bonus credit',
        sendEmail: false
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.transactionId).toBe('tx-1');
    expect(res.body.newBalance).toBe(100);
  });

  it('GET /api/admin/billing/transactions returns paginated history', async () => {
    const mockQuery = query as any;
    const userId = '550e8400-e29b-41d4-a716-446655440000';

    mockQuery
      .mockResolvedValueOnce({ 
        rows: [{ 
          id: 'tx-1', 
          amount: '50.00', 
          status: 'completed',
          created_at: new Date().toISOString()
        }] 
      }) // Transactions
      .mockResolvedValueOnce({ rows: [{ total: '1' }] }); // Count

    const res = await request(app)
      .get(`/api/admin/billing/transactions?userId=${userId}&limit=10`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('GET /api/admin/billing/invoices/:id returns invoice details', async () => {
    const mockQuery = query as any;
    const invoiceId = '550e8400-e29b-41d4-a716-446655440000';

    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('CREATE TABLE')) {
        return { rows: [] };
      }
      return {
        rows: [{
          id: invoiceId,
          invoice_number: 'INV-001',
          html_content: '<html>...</html>',
          total_amount: '100.00',
          currency: 'USD',
          data: '{}'
        }]
      };
    });

    const res = await request(app).get(`/api/admin/billing/invoices/${invoiceId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.invoice.id).toBe(invoiceId);
    expect(res.body.invoice.invoiceNumber).toBe('INV-001');
  });

  it('GET /api/admin/billing/invoices/:id/download returns HTML content', async () => {
    const mockQuery = query as any;
    const invoiceId = '550e8400-e29b-41d4-a716-446655440000';
    const htmlContent = '<html><body>Invoice Content</body></html>';

    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('CREATE TABLE')) {
        return { rows: [] };
      }
      return {
        rows: [{
          id: invoiceId,
          invoice_number: 'INV-001',
          html_content: htmlContent,
          total_amount: '100.00',
          currency: 'USD',
          data: '{}'
        }]
      };
    });

    const res = await request(app).get(`/api/admin/billing/invoices/${invoiceId}/download`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toBe(htmlContent);
  });

  it('POST /api/admin/billing/transactions/:transactionId/invoice generates an invoice', async () => {
    const mockQuery = query as any;
    const transactionId = '550e8400-e29b-41d4-a716-446655440001';
    const invoiceId = '550e8400-e29b-41d4-a716-446655440099';

    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM payment_transactions')) {
        return {
          rows: [{
            id: transactionId,
            organization_id: '550e8400-e29b-41d4-a716-446655440010',
            amount: '25.50',
            currency: 'USD',
            description: 'Wallet top-up',
            created_at: new Date().toISOString(),
            user_id: '550e8400-e29b-41d4-a716-446655440020',
          }],
        };
      }

      if (sql.includes('INSERT INTO billing_invoices') && sql.includes('RETURNING id')) {
        return { rows: [{ id: invoiceId }] };
      }

      return { rows: [] };
    });

    const res = await request(app).post(`/api/admin/billing/transactions/${transactionId}/invoice`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.invoiceId).toBe(invoiceId);
    expect(typeof res.body.invoiceNumber).toBe('string');
  });
});
