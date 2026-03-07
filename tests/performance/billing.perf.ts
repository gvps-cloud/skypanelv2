import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../api/app.js';
import { query } from '../../api/lib/database.js';

vi.mock('../../api/middleware/auth.js', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'admin-id', role: 'admin', organizationId: 'org-id' };
    next();
  },
  requireAdmin: (req: any, res: any, next: any) => next(),
  requireOrganization: (req: any, res: any, next: any) => next(),
}));

vi.mock('../../api/lib/database.js', () => ({
  query: vi.fn(),
}));

vi.mock('../../api/services/paypalService.js', () => ({ PayPalService: {} }));
vi.mock('../../api/services/activityLogger.js', () => ({ logActivity: vi.fn() }));
vi.mock('../../api/services/billingCronService.js', () => ({ BillingCronService: { start: vi.fn() } }));
vi.mock('../../api/services/rateLimitMetrics.js', () => ({
  initializeMetricsCollection: vi.fn(),
  startMetricsPersistence: vi.fn(),
}));

describe('Billing Performance', () => {
  it('loads client list in under 2 seconds with 1000 records', async () => {
    const mockQuery = query as any;
    
    // Generate 1000 mock users
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      id: `u${i}`,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      balance: (Math.random() * 100).toFixed(2),
      currency: 'USD',
      active_services: Math.floor(Math.random() * 5),
      created_at: new Date().toISOString()
    }));

    mockQuery
      .mockResolvedValueOnce({ rows: largeDataset }) // Users
      .mockResolvedValueOnce({ rows: [{ total: '1000' }] }); // Count

    const start = Date.now();
    const res = await request(app).get('/api/admin/billing/users?limit=1000');
    const duration = Date.now() - start;
    
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1000);
    expect(duration).toBeLessThan(2000); 
    
    console.log(`Loaded 1000 users in ${duration}ms`);
  });
});
