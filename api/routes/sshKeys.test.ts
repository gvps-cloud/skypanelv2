import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';

const mockAuth = vi.hoisted(() => ({
  currentUser: {
    id: 'user-1',
    email: 'member@example.com',
    organizationId: 'org-1',
  },
}));

vi.mock('../lib/database.js', () => ({ query: vi.fn() }));
vi.mock('../lib/crypto.js', () => ({ decryptSecret: vi.fn() }));
vi.mock('../services/activityLogger.js', () => ({ logActivity: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../services/linodeService.js', () => ({
  linodeService: { createSSHKey: vi.fn(), deleteSSHKey: vi.fn() },
}));
vi.mock('../services/roles.js', () => ({ RoleService: { checkPermission: vi.fn() } }));
vi.mock('../middleware/auth.js', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = mockAuth.currentUser;
    next();
  },
  requireOrganization: (_req: any, _res: any, next: any) => next(),
}));

import { query } from '../lib/database.js';
import { logActivity } from '../services/activityLogger.js';
import { RoleService } from '../services/roles.js';
import sshKeysRouter from './sshKeys.js';

const VALID_PUBLIC_KEY =
  'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDc7WmFZ2F2WUh4M0xjWlBmY2R1QWJmQ3VJb1h5Q2d2Q0dFVmx1bWlLQmtMZ2p5c3VvV2xZVUtZb0d2Q2tBclpZZnd1T09wS2E2VnN0cFN6Q1B5dHhmR1VZV29aUQ== test@example.com';

describe('SSH key routes', () => {
  let app: Express;

  beforeEach(() => {
    (query as any).mockReset();
    (RoleService.checkPermission as any).mockReset();
    (logActivity as any).mockReset().mockResolvedValue(undefined);
    mockAuth.currentUser = {
      id: 'user-1',
      email: 'member@example.com',
      organizationId: 'org-1',
    };
    app = express();
    app.use(express.json());
    app.use('/api/ssh-keys', sshKeysRouter);
  });

  it('lists SSH keys for the active organization', async () => {
    (RoleService.checkPermission as any).mockResolvedValue(true);
    (query as any).mockResolvedValueOnce({
      rows: [{
        id: 'key-1', organization_id: 'org-1', name: 'Deploy Key', public_key: VALID_PUBLIC_KEY,
        fingerprint: 'aa:bb', linode_key_id: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
      }],
    });

    const response = await request(app).get('/api/ssh-keys');

    expect(response.status).toBe(200);
    expect(response.body.keys).toEqual([expect.objectContaining({ id: 'key-1', name: 'Deploy Key' })]);
    expect(RoleService.checkPermission).toHaveBeenCalledWith('user-1', 'org-1', 'ssh_keys_view');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE organization_id = $1'), ['org-1']);
  });

  it('blocks listing SSH keys without view permission', async () => {
    (RoleService.checkPermission as any).mockResolvedValue(false);

    const response = await request(app).get('/api/ssh-keys');

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('You do not have permission to view SSH keys');
    expect(query).not.toHaveBeenCalled();
  });

  it('stores new SSH keys under the active organization', async () => {
    (RoleService.checkPermission as any).mockResolvedValue(true);
    (query as any)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ name: 'Acme Org' }] })
      .mockResolvedValueOnce({
        rows: [{
          id: 'key-1', organization_id: 'org-1', name: 'Deploy Key', public_key: VALID_PUBLIC_KEY,
          fingerprint: 'generated-fingerprint', linode_key_id: null,
          created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
        }],
      });

    const response = await request(app)
      .post('/api/ssh-keys')
      .send({ name: 'Deploy Key', publicKey: VALID_PUBLIC_KEY });

    const insertCall = (query as any).mock.calls.find(([sql]: [string]) => sql.includes('INSERT INTO user_ssh_keys'));

    expect(response.status).toBe(201);
    expect(RoleService.checkPermission).toHaveBeenCalledWith('user-1', 'org-1', 'ssh_keys_manage');
    expect(insertCall?.[1]?.[0]).toBe('org-1');
    expect(response.body.key).toEqual(expect.objectContaining({ id: 'key-1', name: 'Deploy Key' }));
    expect(logActivity).toHaveBeenCalled();
  });

  it('rejects duplicate SSH keys within the same organization', async () => {
    (RoleService.checkPermission as any).mockResolvedValue(true);
    (query as any).mockResolvedValueOnce({ rows: [{ id: 'existing-key' }] });

    const response = await request(app)
      .post('/api/ssh-keys')
      .send({ name: 'Duplicate Key', publicKey: VALID_PUBLIC_KEY });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('This SSH key already exists for this organization');
  });

  it('blocks SSH key creation without manage permission', async () => {
    (RoleService.checkPermission as any).mockResolvedValue(false);

    const response = await request(app)
      .post('/api/ssh-keys')
      .send({ name: 'Blocked Key', publicKey: VALID_PUBLIC_KEY });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('You do not have permission to manage SSH keys');
    expect(query).not.toHaveBeenCalled();
  });

  it('blocks SSH key deletion without manage permission', async () => {
    (RoleService.checkPermission as any).mockResolvedValue(false);

    const response = await request(app).delete('/api/ssh-keys/key-1');

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('You do not have permission to manage SSH keys');
    expect(query).not.toHaveBeenCalled();
  });

  it('prevents deleting a key from another organization', async () => {
    (RoleService.checkPermission as any).mockResolvedValue(true);
    (query as any).mockResolvedValueOnce({
      rows: [{ id: 'key-2', organization_id: 'org-2', name: 'Other Org Key', fingerprint: 'bb:cc', linode_key_id: null }],
    });

    const response = await request(app).delete('/api/ssh-keys/key-2');

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('You do not have permission to delete this SSH key');
    expect((query as any).mock.calls.some(([sql]: [string]) => sql === 'DELETE FROM user_ssh_keys WHERE id = $1')).toBe(false);
  });
});