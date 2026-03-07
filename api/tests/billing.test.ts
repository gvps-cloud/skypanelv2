import { describe, it, expect, vi } from 'vitest';
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
}));

// Mock database
vi.mock('../lib/database.js', () => ({
  query: vi.fn(),
}));

// Mock services to avoid side effects
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
}));

describe('Admin Billing API', () => {
  it('GET /api/admin/billing/stats returns stats', async () => {
    const mockQuery = query as any;
    
    // Mock sequential queries in stats endpoint
    // 1. Revenue
    // 2. Wallet Balance
    // 3. Transaction Count
    // 4. Low Balance
    // 5. Monthly Revenue
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
    expect(res.body.stats.totalWalletBalance).toBe(500);
    expect(res.body.stats.totalTransactions).toBe(10);
    expect(res.body.stats.lowBalanceCount).toBe(2);
    expect(res.body.stats.monthlyRevenue).toHaveLength(1);
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
      }) // Users
      .mockResolvedValueOnce({ rows: [{ total: '1' }] }); // Count

    const res = await request(app).get('/api/admin/billing/users');
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].balance).toBe(50);
  });
});
