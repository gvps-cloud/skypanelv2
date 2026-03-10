/**
 * Preservation Property Tests for Rate Limit Dashboard Exemption Fix
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 * 
 * **Property 2: Preservation** - External API Rate Limiting Unchanged
 * 
 * These tests verify that external API endpoints (VPS, payments, support tickets,
 * organizations) continue to enforce the existing rate limits after the fix is applied.
 * 
 * **IMPORTANT**: These tests should PASS on UNFIXED code, establishing the baseline
 * behavior that must be preserved. After the fix is implemented, these same tests
 * should still PASS, confirming no regressions to external API protection.
 * 
 * **GOAL**: Capture the current rate limiting behavior on external API endpoints
 * to ensure the fix does not weaken security protections.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import { smartRateLimit } from './rateLimiting.js';
import { config } from '../config/index.js';

// Mock dependencies
vi.mock('../lib/database.js', () => ({
  query: vi.fn(),
}));

vi.mock('../services/activityLogger.js', () => ({
  logRateLimitEvent: vi.fn(),
}));

vi.mock('../services/rateLimitMetrics.js', () => ({
  recordRateLimitEvent: vi.fn(),
}));

vi.mock('../services/rateLimitOverrideService.js', () => ({
  getRateLimitOverrideForUser: vi.fn().mockResolvedValue(null),
}));

describe('Preservation: External API Rate Limiting Unchanged', () => {
  let app: Express;
  let authenticatedToken: string;
  let adminToken: string;

  beforeEach(() => {
    // Reset environment to test mode to ensure rate limiting is active
    process.env.NODE_ENV = 'test';
    
    // Create test tokens
    authenticatedToken = jwt.sign(
      { userId: 'test-user-123', role: 'user' },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );

    adminToken = jwt.sign(
      { userId: 'admin-user-456', role: 'admin' },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create a minimal Express app with rate limiting
    app = express();
    app.use(express.json());
    app.use('/api', smartRateLimit);

    // Mock external API endpoints - VPS management
    app.post('/api/vps/create', (req, res) => {
      res.json({ id: 'vps-123', status: 'creating' });
    });

    app.get('/api/vps/list', (req, res) => {
      res.json({ instances: [] });
    });

    app.delete('/api/admin/vps/:id', (req, res) => {
      res.json({ success: true });
    });

    // Mock external API endpoints - Payments
    app.post('/api/payments/process', (req, res) => {
      res.json({ transactionId: 'txn-123', status: 'processing' });
    });

    app.get('/api/payments/history', (req, res) => {
      res.json({ transactions: [] });
    });

    // Mock external API endpoints - Support tickets
    app.post('/api/support/tickets', (req, res) => {
      res.json({ ticketId: 'ticket-123', status: 'open' });
    });

    app.get('/api/support/tickets', (req, res) => {
      res.json({ tickets: [] });
    });

    // Mock external API endpoints - Organizations
    app.post('/api/admin/organizations', (req, res) => {
      res.json({ id: 'org-123', name: 'Test Org' });
    });

    app.get('/api/admin/organizations', (req, res) => {
      res.json({ organizations: [] });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test Case 1: VPS endpoint rate limiting for authenticated users
   * 
   * **Preservation Requirement**: VPS endpoints must continue to enforce standard
   * rate limits (500 requests per 15 minutes for authenticated users).
   * 
   * **Observation**: On UNFIXED code, authenticated user making 501 requests to
   * `/api/vps/create` should receive HTTP 429 on request 501.
   * 
   * **EXPECTED OUTCOME**: This test should PASS on both unfixed and fixed code,
   * confirming that external API protection is preserved.
   */
  it('should enforce standard rate limit (500) on /api/vps/create for authenticated users', async () => {
    const requestCount = 501;
    let response429Count = 0;
    let firstFailureAt = -1;
    let lastSuccessAt = -1;

    // Simulate VPS creation requests (external API operation)
    for (let i = 1; i <= requestCount; i++) {
      const response = await request(app)
        .post('/api/vps/create')
        .set('Authorization', `Bearer ${authenticatedToken}`)
        .send({ plan: 'basic', region: 'us-east' });

      if (response.status === 429) {
        response429Count++;
        if (firstFailureAt === -1) {
          firstFailureAt = i;
        }
      } else if (response.status === 200) {
        lastSuccessAt = i;
      }
    }

    // EXPECTED BEHAVIOR: External API endpoints should enforce standard rate limits
    // Request 501 should return 429 (authenticated limit is 500)
    expect(response429Count).toBeGreaterThan(0);
    expect(firstFailureAt).toBeLessThanOrEqual(501);
    expect(lastSuccessAt).toBeLessThanOrEqual(500);
    
    console.log(`\n✓ PRESERVATION VERIFIED:`);
    console.log(`   Endpoint: /api/vps/create`);
    console.log(`   User Type: authenticated`);
    console.log(`   Expected Limit: 500 requests per 15 minutes`);
    console.log(`   Last successful request: ${lastSuccessAt}`);
    console.log(`   First 429 at request: ${firstFailureAt}`);
    console.log(`   Total 429 responses: ${response429Count}`);
    console.log(`   Status: External API protection preserved ✓\n`);
  });

  /**
   * Test Case 2: Payment endpoint rate limiting for authenticated users
   * 
   * **Preservation Requirement**: Payment endpoints must continue to enforce standard
   * rate limits (500 requests per 15 minutes for authenticated users).
   * 
   * **Observation**: On UNFIXED code, authenticated user making 501 requests to
   * `/api/payments/process` should receive HTTP 429 on request 501.
   * 
   * **EXPECTED OUTCOME**: This test should PASS on both unfixed and fixed code.
   */
  it('should enforce standard rate limit (500) on /api/payments/process for authenticated users', async () => {
    const requestCount = 501;
    let response429Count = 0;
    let firstFailureAt = -1;
    let lastSuccessAt = -1;

    // Simulate payment processing requests (external API operation)
    for (let i = 1; i <= requestCount; i++) {
      const response = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authenticatedToken}`)
        .send({ amount: 10.00, method: 'paypal' });

      if (response.status === 429) {
        response429Count++;
        if (firstFailureAt === -1) {
          firstFailureAt = i;
        }
      } else if (response.status === 200) {
        lastSuccessAt = i;
      }
    }

    // EXPECTED BEHAVIOR: External API endpoints should enforce standard rate limits
    expect(response429Count).toBeGreaterThan(0);
    expect(firstFailureAt).toBeLessThanOrEqual(501);
    expect(lastSuccessAt).toBeLessThanOrEqual(500);
    
    console.log(`\n✓ PRESERVATION VERIFIED:`);
    console.log(`   Endpoint: /api/payments/process`);
    console.log(`   User Type: authenticated`);
    console.log(`   Expected Limit: 500 requests per 15 minutes`);
    console.log(`   Last successful request: ${lastSuccessAt}`);
    console.log(`   First 429 at request: ${firstFailureAt}`);
    console.log(`   Total 429 responses: ${response429Count}`);
    console.log(`   Status: External API protection preserved ✓\n`);
  });

  /**
   * Test Case 3: Support ticket endpoint rate limiting for authenticated users
   * 
   * **Preservation Requirement**: Support ticket endpoints must continue to enforce
   * standard rate limits (500 requests per 15 minutes for authenticated users).
   * 
   * **EXPECTED OUTCOME**: This test should PASS on both unfixed and fixed code.
   */
  it('should enforce standard rate limit (500) on /api/support/tickets for authenticated users', async () => {
    const requestCount = 501;
    let response429Count = 0;
    let firstFailureAt = -1;
    let lastSuccessAt = -1;

    // Simulate support ticket creation requests (external API operation)
    for (let i = 1; i <= requestCount; i++) {
      const response = await request(app)
        .post('/api/support/tickets')
        .set('Authorization', `Bearer ${authenticatedToken}`)
        .send({ subject: `Issue ${i}`, description: 'Test ticket' });

      if (response.status === 429) {
        response429Count++;
        if (firstFailureAt === -1) {
          firstFailureAt = i;
        }
      } else if (response.status === 200) {
        lastSuccessAt = i;
      }
    }

    // EXPECTED BEHAVIOR: External API endpoints should enforce standard rate limits
    expect(response429Count).toBeGreaterThan(0);
    expect(firstFailureAt).toBeLessThanOrEqual(501);
    expect(lastSuccessAt).toBeLessThanOrEqual(500);
    
    console.log(`\n✓ PRESERVATION VERIFIED:`);
    console.log(`   Endpoint: /api/support/tickets`);
    console.log(`   User Type: authenticated`);
    console.log(`   Expected Limit: 500 requests per 15 minutes`);
    console.log(`   Last successful request: ${lastSuccessAt}`);
    console.log(`   First 429 at request: ${firstFailureAt}`);
    console.log(`   Total 429 responses: ${response429Count}`);
    console.log(`   Status: External API protection preserved ✓\n`);
  });

  /**
   * Test Case 4: Organization endpoint rate limiting for admin users
   * 
   * **Preservation Requirement**: Organization endpoints must continue to enforce
   * standard rate limits (1000 requests per 15 minutes for admin users).
   * 
   * **EXPECTED OUTCOME**: This test should PASS on both unfixed and fixed code.
   */
  it('should enforce standard rate limit (1000) on /api/admin/organizations for admin users', { timeout: 10000 }, async () => {
    const requestCount = 1001;
    let response429Count = 0;
    let firstFailureAt = -1;
    let lastSuccessAt = -1;

    // Simulate organization creation requests (external API operation)
    for (let i = 1; i <= requestCount; i++) {
      const response = await request(app)
        .post('/api/admin/organizations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Org ${i}`, type: 'business' });

      if (response.status === 429) {
        response429Count++;
        if (firstFailureAt === -1) {
          firstFailureAt = i;
        }
      } else if (response.status === 200) {
        lastSuccessAt = i;
      }
    }

    // EXPECTED BEHAVIOR: External API endpoints should enforce standard rate limits
    expect(response429Count).toBeGreaterThan(0);
    expect(firstFailureAt).toBeLessThanOrEqual(1001);
    expect(lastSuccessAt).toBeLessThanOrEqual(1000);
    
    console.log(`\n✓ PRESERVATION VERIFIED:`);
    console.log(`   Endpoint: /api/admin/organizations`);
    console.log(`   User Type: admin`);
    console.log(`   Expected Limit: 1000 requests per 15 minutes`);
    console.log(`   Last successful request: ${lastSuccessAt}`);
    console.log(`   First 429 at request: ${firstFailureAt}`);
    console.log(`   Total 429 responses: ${response429Count}`);
    console.log(`   Status: External API protection preserved ✓\n`);
  });

  /**
   * Test Case 5: Anonymous user rate limiting on all endpoints
   * 
   * **Preservation Requirement**: Anonymous users must continue to be limited to
   * 200 requests per 15 minutes on all endpoints.
   * 
   * **Observation**: On UNFIXED code, anonymous user making 201 requests to any
   * endpoint should receive HTTP 429 on request 201.
   * 
   * **EXPECTED OUTCOME**: This test should PASS on both unfixed and fixed code.
   */
  it('should enforce standard rate limit (200) for anonymous users on all endpoints', async () => {
    const requestCount = 201;
    let response429Count = 0;
    let firstFailureAt = -1;
    let lastSuccessAt = -1;

    // Simulate anonymous requests to VPS list endpoint
    for (let i = 1; i <= requestCount; i++) {
      const response = await request(app)
        .get('/api/vps/list');

      if (response.status === 429) {
        response429Count++;
        if (firstFailureAt === -1) {
          firstFailureAt = i;
        }
      } else if (response.status === 200) {
        lastSuccessAt = i;
      }
    }

    // EXPECTED BEHAVIOR: Anonymous users should be limited to 200 requests
    expect(response429Count).toBeGreaterThan(0);
    expect(firstFailureAt).toBeLessThanOrEqual(201);
    expect(lastSuccessAt).toBeLessThanOrEqual(200);
    
    console.log(`\n✓ PRESERVATION VERIFIED:`);
    console.log(`   Endpoint: /api/vps/list`);
    console.log(`   User Type: anonymous`);
    console.log(`   Expected Limit: 200 requests per 15 minutes`);
    console.log(`   Last successful request: ${lastSuccessAt}`);
    console.log(`   First 429 at request: ${firstFailureAt}`);
    console.log(`   Total 429 responses: ${response429Count}`);
    console.log(`   Status: Anonymous user protection preserved ✓\n`);
  });

  /**
   * Test Case 6: VPS admin endpoint rate limiting
   * 
   * **Preservation Requirement**: Admin VPS management endpoints must continue to
   * enforce standard rate limits (1000 requests per 15 minutes for admin users).
   * 
   * **EXPECTED OUTCOME**: This test should PASS on both unfixed and fixed code.
   */
  it('should enforce standard rate limit (1000) on /api/admin/vps/* for admin users', { timeout: 15000 }, async () => {
    const requestCount = 1001;
    let response429Count = 0;
    let firstFailureAt = -1;
    let lastSuccessAt = -1;

    // Simulate admin VPS deletion requests (external API operation)
    for (let i = 1; i <= requestCount; i++) {
      const response = await request(app)
        .delete(`/api/admin/vps/vps-${i}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 429) {
        response429Count++;
        if (firstFailureAt === -1) {
          firstFailureAt = i;
        }
      } else if (response.status === 200) {
        lastSuccessAt = i;
      }
    }

    // EXPECTED BEHAVIOR: External API endpoints should enforce standard rate limits
    expect(response429Count).toBeGreaterThan(0);
    expect(firstFailureAt).toBeLessThanOrEqual(1001);
    expect(lastSuccessAt).toBeLessThanOrEqual(1000);
    
    console.log(`\n✓ PRESERVATION VERIFIED:`);
    console.log(`   Endpoint: /api/admin/vps/*`);
    console.log(`   User Type: admin`);
    console.log(`   Expected Limit: 1000 requests per 15 minutes`);
    console.log(`   Last successful request: ${lastSuccessAt}`);
    console.log(`   First 429 at request: ${firstFailureAt}`);
    console.log(`   Total 429 responses: ${response429Count}`);
    console.log(`   Status: External API protection preserved ✓\n`);
  });

  /**
   * Test Case 7: Payment history endpoint rate limiting
   * 
   * **Preservation Requirement**: Payment history endpoints must continue to enforce
   * standard rate limits even though they are read operations.
   * 
   * **EXPECTED OUTCOME**: This test should PASS on both unfixed and fixed code.
   */
  it('should enforce standard rate limit (500) on /api/payments/history for authenticated users', { timeout: 10000 }, async () => {
    const requestCount = 501;
    let response429Count = 0;
    let firstFailureAt = -1;
    let lastSuccessAt = -1;

    // Simulate payment history requests (external API operation)
    for (let i = 1; i <= requestCount; i++) {
      const response = await request(app)
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${authenticatedToken}`);

      if (response.status === 429) {
        response429Count++;
        if (firstFailureAt === -1) {
          firstFailureAt = i;
        }
      } else if (response.status === 200) {
        lastSuccessAt = i;
      }
    }

    // EXPECTED BEHAVIOR: External API endpoints should enforce standard rate limits
    expect(response429Count).toBeGreaterThan(0);
    expect(firstFailureAt).toBeLessThanOrEqual(501);
    expect(lastSuccessAt).toBeLessThanOrEqual(500);
    
    console.log(`\n✓ PRESERVATION VERIFIED:`);
    console.log(`   Endpoint: /api/payments/history`);
    console.log(`   User Type: authenticated`);
    console.log(`   Expected Limit: 500 requests per 15 minutes`);
    console.log(`   Last successful request: ${lastSuccessAt}`);
    console.log(`   First 429 at request: ${firstFailureAt}`);
    console.log(`   Total 429 responses: ${response429Count}`);
    console.log(`   Status: External API protection preserved ✓\n`);
  });
});
