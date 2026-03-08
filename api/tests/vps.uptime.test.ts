import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { query } from '../lib/database.js';
import { RoleService } from '../services/roles.js';

// stub auth middleware so we can control the user object
vi.mock('../middleware/auth.js', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    // default identity, tests override as needed
    req.user = { id: 'user-1', role: 'user', organizationId: null };
    next();
  },
  requireOrganization: (req: any, res: any, next: any) => next(),
}));

// mock database and role service
vi.mock('../lib/database.js', () => ({
  query: vi.fn(),
}));
vi.mock('../services/roles.js', () => ({
  RoleService: {
    checkPermission: vi.fn(),
  },
}));

const mockQuery = query as any;
const mockCheckPermission = (RoleService as any).checkPermission as any;

describe('VPS uptime summary privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('regular user without vps_view sees only personal instances', async () => {
    // user not in organization, no permission
    vi.mocked(require('../middleware/auth.js')).authenticateToken = (req: any, res: any, next: any) => {
      req.user = { id: 'user-1', role: 'user', organizationId: null };
      next();
    };

    mockCheckPermission.mockResolvedValueOnce(false);

    // perform request
    await request(app).get('/api/vps/uptime-summary');

    expect(mockQuery).toHaveBeenCalled();
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('organization_id IS NULL');
    expect(sql).toContain('created_by = $1');
  });

  it('user with vps_view permission scoped to org', async () => {
    vi.mocked(require('../middleware/auth.js')).authenticateToken = (req: any, res: any, next: any) => {
      req.user = { id: 'user-2', role: 'user', organizationId: 'org-2' };
      next();
    };

    mockCheckPermission.mockResolvedValueOnce(true);

    await request(app).get('/api/vps/uptime-summary');

    expect(mockQuery).toHaveBeenCalled();
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('WHERE vi.organization_id = $1');
  });

  it('admin does not get global dataset when not part of an org', async () => {
    vi.mocked(require('../middleware/auth.js')).authenticateToken = (req: any, res: any, next: any) => {
      req.user = { id: 'admin-1', role: 'admin' };
      next();
    };

    // admin has no org, checkPermission will also be invoked with undefined org
    mockCheckPermission.mockResolvedValueOnce(false);

    await request(app).get('/api/vps/uptime-summary');

    expect(mockQuery).toHaveBeenCalled();
    const sql = mockQuery.mock.calls[0][0] as string;
    // should not be the unfiltered admin query anymore
    expect(sql).not.toMatch(/FROM vps_instances vi\s+LEFT JOIN vps_plans vp ON vi.plan_id::uuid = vp.id\s+ORDER BY vi.created_at DESC$/);
    // should fall back to personal query
    expect(sql).toContain('organization_id IS NULL');
  });
});
