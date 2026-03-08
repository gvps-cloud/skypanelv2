import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { query } from '../lib/database.js';

// We'll load the real middleware implementation but mock query responses
vi.mock('../lib/database.js', () => ({
  query: vi.fn(),
}));

// simple route to invoke authentication
app.get('/test-auth', (req, res) => {
  res.json({ ok: true, user: (req as any).user });
});

const mockQuery = query as any;

describe('Authentication middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-creates organization for regular user with no membership', async () => {
    // simulate user lookup first, then no membership, no owner org, then insert new org
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user1', email: 'u@test', role: 'user' }] }) // user lookup
      .mockResolvedValueOnce({ rows: [] }) // membership lookup
      .mockResolvedValueOnce({ rows: [] }) // ownerOrg lookup
      .mockResolvedValueOnce({ rows: [{ id: 'new-org' }] }); // insert

    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ userId: 'user1' }, process.env.JWT_SECRET || 'test');

    const res = await request(app).get('/test-auth').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalled();
    // last call should be the INSERT
    const lastSql = mockQuery.mock.calls[mockQuery.mock.calls.length - 1][0];
    expect(lastSql).toMatch(/INSERT INTO organizations/);

    expect(res.body.user.organizationId).toBe('new-org');
  });

  it('does not auto-create organization for admin user', async () => {
    // simulate user lookup first, then membership and owner lookups
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'admin1', email: 'a@test', role: 'admin' }] }) // user lookup
      .mockResolvedValueOnce({ rows: [] }) // membership lookup
      .mockResolvedValueOnce({ rows: [] }); // ownerOrg lookup

    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ userId: 'admin1' }, process.env.JWT_SECRET || 'test');

    const res = await request(app).get('/test-auth').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    // ensure we never attempted to insert an organization
    const allSql = mockQuery.mock.calls.map((c: any) => c[0]);
    expect(allSql.some((sql: string) => /INSERT INTO organizations/.test(sql))).toBe(false);

    // user object should have no organizationId (or undefined)
    expect(res.body.user.organizationId).toBeUndefined();
  });
});
