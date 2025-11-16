import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

const queryMock = vi.hoisted(() => vi.fn()) as Mock;
const buildQueueAddMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: 'job-123', data: {} })
);
const envUpsertMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));

vi.mock('../middleware/auth.js', () => ({
  authenticateToken: (req: any, _res: express.Response, next: express.NextFunction) => {
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    next();
  },
  requireOrganization: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../lib/database.js', () => ({
  pool: {
    query: queryMock,
  },
}));

vi.mock('../worker/queues.js', () => ({
  buildQueue: {
    add: buildQueueAddMock,
  },
  deployQueue: {
    add: vi.fn(),
  },
}));

vi.mock('../services/activityLogger.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/paas/environmentService.js', () => ({
  PaasEnvironmentService: {
    list: vi.fn(),
    upsertMany: envUpsertMock,
    parseEnv: vi.fn(),
    export: vi.fn(),
    delete: vi.fn(),
  },
}));

import paasRouter from './paas.js';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/paas', paasRouter);
  return app;
};

const TEMPLATE_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const PLAN_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const APP_ID = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';

describe('POST /api/paas/marketplace/deploy/:slug', () => {
  beforeEach(() => {
    queryMock.mockReset();
    buildQueueAddMock.mockClear();
    buildQueueAddMock.mockResolvedValue({ id: 'job-123', data: {} });
    envUpsertMock.mockReset();
    envUpsertMock.mockResolvedValue([]);
  });

  it('serializes empty addon list as JSON array string', async () => {
    let capturedTemplateParams: any[] | null = null;

    queryMock.mockImplementation((sql: string, params?: any[]) => {
      if (sql.includes('FROM paas_marketplace_templates')) {
        return Promise.resolve({
          rows: [
            {
              id: TEMPLATE_ID,
              name: 'WordPress',
              slug: 'wordpress',
              git_url: 'https://example.com/wordpress.git',
              git_branch: 'main',
              buildpack: 'heroku/php',
              default_env_vars: {},
              min_cpu_cores: 1,
              min_ram_mb: 512,
            },
          ],
        });
      }
      if (sql.includes('SELECT id FROM paas_applications')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('FROM paas_plans')) {
        return Promise.resolve({
          rows: [
            {
              id: PLAN_ID,
              cpu_cores: 1,
              ram_mb: 1024,
            },
          ],
        });
      }
      if (sql.startsWith('INSERT INTO paas_applications')) {
        return Promise.resolve({
          rows: [
            {
              id: APP_ID,
              git_url: 'https://example.com/wordpress.git',
              git_branch: 'main',
              buildpack: 'heroku/php',
              replicas: 1,
            },
          ],
        });
      }
      if (sql.startsWith('INSERT INTO paas_template_deployments')) {
        capturedTemplateParams = params ?? [];
        return Promise.resolve({ rows: [{ id: 'deployment-record' }] });
      }
      if (sql.startsWith('UPDATE paas_marketplace_templates')) {
        return Promise.resolve({ rows: [] });
      }
      throw new Error(`Unhandled query in test: ${sql}`);
    });

    const response = await request(createTestApp())
      .post('/api/paas/marketplace/deploy/wordpress')
      .send({
        name: 'My WordPress App',
        plan_id: PLAN_ID,
        custom_env_vars: {},
      });

    expect(response.status).toBe(201);
    expect(capturedTemplateParams).not.toBeNull();
    expect(capturedTemplateParams?.[4]).toBe('[]');
    expect(JSON.parse(String(capturedTemplateParams?.[3]))).toEqual({});
    expect(envUpsertMock).not.toHaveBeenCalled();
  });

  it('persists only valid addon ids in JSON payloads and provisioning inserts', async () => {
    let capturedTemplateParams: any[] | null = null;
    const addonInsertIds: string[] = [];
    const validAddonId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

    queryMock.mockImplementation((sql: string, params?: any[]) => {
      if (sql.includes('FROM paas_marketplace_templates')) {
        return Promise.resolve({
          rows: [
            {
              id: TEMPLATE_ID,
              name: 'Node Starter',
              slug: 'nodejs-express',
              git_url: 'https://example.com/node.git',
              git_branch: 'main',
              buildpack: 'heroku/nodejs',
              default_env_vars: {},
              min_cpu_cores: 1,
              min_ram_mb: 512,
            },
          ],
        });
      }
      if (sql.includes('SELECT id FROM paas_applications')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('FROM paas_plans')) {
        return Promise.resolve({
          rows: [
            {
              id: PLAN_ID,
              cpu_cores: 2,
              ram_mb: 2048,
            },
          ],
        });
      }
      if (sql.startsWith('INSERT INTO paas_applications')) {
        return Promise.resolve({
          rows: [
            {
              id: APP_ID,
              git_url: 'https://example.com/node.git',
              git_branch: 'main',
              buildpack: 'heroku/nodejs',
              replicas: 1,
            },
          ],
        });
      }
      if (sql.startsWith('INSERT INTO paas_template_deployments')) {
        capturedTemplateParams = params ?? [];
        return Promise.resolve({ rows: [{ id: 'deployment-record' }] });
      }
      if (sql.startsWith('UPDATE paas_marketplace_templates')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.startsWith('INSERT INTO paas_app_addons')) {
        addonInsertIds.push(params?.[1]);
        return Promise.resolve({ rows: [] });
      }
      throw new Error(`Unhandled query in test: ${sql}`);
    });

    const response = await request(createTestApp())
      .post('/api/paas/marketplace/deploy/nodejs-express')
      .send({
        name: 'My Node App',
        plan_id: PLAN_ID,
        custom_env_vars: {},
        selected_addons: [validAddonId, 'not-a-uuid', validAddonId, 123],
      });

    expect(response.status).toBe(201);
    expect(capturedTemplateParams).not.toBeNull();
    expect(JSON.parse(String(capturedTemplateParams?.[4]))).toEqual([validAddonId]);
    expect(addonInsertIds).toEqual([validAddonId]);
    expect(envUpsertMock).not.toHaveBeenCalled();
  });

  it('upserts merged environment variables with stringified values', async () => {
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM paas_marketplace_templates')) {
        return Promise.resolve({
          rows: [
            {
              id: TEMPLATE_ID,
              name: 'Node Starter',
              slug: 'nodejs-express',
              git_url: 'https://example.com/node.git',
              git_branch: 'main',
              buildpack: 'heroku/nodejs',
              default_env_vars: { NODE_ENV: 'production' },
              min_cpu_cores: 1,
              min_ram_mb: 512,
            },
          ],
        });
      }
      if (sql.includes('SELECT id FROM paas_applications')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('FROM paas_plans')) {
        return Promise.resolve({
          rows: [
            {
              id: PLAN_ID,
              cpu_cores: 2,
              ram_mb: 2048,
            },
          ],
        });
      }
      if (sql.startsWith('INSERT INTO paas_applications')) {
        return Promise.resolve({
          rows: [
            {
              id: APP_ID,
              git_url: 'https://example.com/node.git',
              git_branch: 'main',
              buildpack: 'heroku/nodejs',
              replicas: 1,
            },
          ],
        });
      }
      if (sql.startsWith('INSERT INTO paas_template_deployments')) {
        return Promise.resolve({ rows: [{ id: 'deployment-record' }] });
      }
      if (sql.startsWith('UPDATE paas_marketplace_templates')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(createTestApp())
      .post('/api/paas/marketplace/deploy/nodejs-express')
      .send({
        name: 'Env Test',
        plan_id: PLAN_ID,
        custom_env_vars: {
          API_KEY: 'secret',
          TIMEOUT_SECONDS: 30,
          ENABLE_ANALYTICS: true,
          invalid_nested: { nope: true },
        },
      });

    expect(response.status).toBe(201);
    expect(envUpsertMock).toHaveBeenCalledWith(APP_ID, 'org-1', {
      NODE_ENV: 'production',
      API_KEY: 'secret',
      TIMEOUT_SECONDS: '30',
      ENABLE_ANALYTICS: 'true',
    });
  });
});
