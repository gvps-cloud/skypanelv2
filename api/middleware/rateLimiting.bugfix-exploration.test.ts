/**
 * Bug Condition Exploration Test for Rate Limit Dashboard Exemption Fix
 * 
 * **Validates: Requirements 2.1, 2.2, 2.4**
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists.
 * 
 * **Property 1: Bug Condition** - Dashboard Endpoints Return 429 Under Normal Usage
 * 
 * This test encodes the EXPECTED BEHAVIOR: dashboard endpoints should NOT return 429
 * during normal usage. When run on UNFIXED code, it will FAIL, proving the bug exists.
 * After the fix is implemented, this same test will PASS, confirming the bug is resolved.
 * 
 * **GOAL**: Surface counterexamples that demonstrate dashboard endpoints hit rate limits
 * during normal usage patterns.
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

describe('Bug Condition Exploration: Dashboard Endpoints Return 429 Under Normal Usage', () => {
  let app: Express;
  let authenticatedToken: string;
  let adminToken: string;

  beforeEach(() => {
    // Reset environment to production mode to ensure rate limiting is active
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
    app.use('/api', smartRateLimit);

    // Mock dashboard endpoints
    app.get('/api/auth/me', (req, res) => {
      res.json({ id: 'test-user-123', email: 'test@example.com' });
    });

    app.get('/api/notifications/unread', (req, res) => {
      res.json({ count: 0, notifications: [] });
    });

    app.get('/api/admin/users/search', (req, res) => {
      res.json({ users: [] });
    });

    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok' });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test Case 1: Authenticated user polling /api/auth/me
   * 
   * **Bug Condition**: Authenticated users have a limit of 500 requests per 15 minutes.
   * When the dashboard polls /api/auth/me frequently (e.g., every 30 seconds), the user
   * will hit this limit and receive HTTP 429, causing the dashboard to log them out.
   * 
   * **Expected Behavior**: Dashboard endpoints should have significantly higher limits
   * (10x base limits = 5000 for authenticated users) to prevent disruption during normal usage.
   * 
   * **EXPECTED OUTCOME ON UNFIXED CODE**: This test will FAIL because request 501 returns 429.
   * **EXPECTED OUTCOME ON FIXED CODE**: This test will PASS because dashboard endpoints have 10x limits.
   */
  it('should NOT return 429 when authenticated user makes 501 requests to /api/auth/me (dashboard endpoint)', async () => {
    const requestCount = 501;
    let response429Count = 0;
    let firstFailureAt = -1;

    // Simulate rapid polling of auth status (normal dashboard behavior)
    for (let i = 1; i <= requestCount; i++) {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authenticatedToken}`);

      if (response.status === 429) {
        response429Count++;
        if (firstFailureAt === -1) {
          firstFailureAt = i;
        }
      }
    }

    // EXPECTED BEHAVIOR: Dashboard endpoints should NOT return 429 during normal usage
    // On UNFIXED code, this assertion will FAIL, proving the bug exists
    // On FIXED code, this assertion will PASS, confirming the fix works
    expect(response429Count).toBe(0);
    
    // If the test fails, document the counterexample
    if (response429Count > 0) {
      console.log(`\n🐛 COUNTEREXAMPLE FOUND:`);
      console.log(`   Endpoint: /api/auth/me`);
      console.log(`   User Type: authenticated`);
      console.log(`   First 429 at request: ${firstFailureAt}`);
      console.log(`   Total 429 responses: ${response429Count}`);
      console.log(`   Expected: 0 (dashboard endpoints should not rate limit during normal usage)`);
      console.log(`   Actual: ${response429Count} (bug confirmed - dashboard endpoints are rate limited)\n`);
    }
  });

  /**
   * Test Case 2: Admin user polling /api/notifications/unread
   * 
   * **Bug Condition**: Admin users have a limit of 1000 requests per 15 minutes.
   * When the dashboard polls /api/notifications/unread frequently (e.g., every 10 seconds),
   * the admin will hit this limit and receive HTTP 429, disrupting real-time notifications.
   * 
   * **Expected Behavior**: Dashboard endpoints should have significantly higher limits
   * (10x base limits = 10000 for admin users) to prevent disruption during normal usage.
   * 
   * **EXPECTED OUTCOME ON UNFIXED CODE**: This test will FAIL because request 1001 returns 429.
   * **EXPECTED OUTCOME ON FIXED CODE**: This test will PASS because dashboard endpoints have 10x limits.
   */
  it('should NOT return 429 when admin user makes 1001 requests to /api/notifications/unread (dashboard endpoint)', { timeout: 15000 }, async () => {
    const requestCount = 1001;
    let response429Count = 0;
    let firstFailureAt = -1;

    // Simulate rapid polling of notifications (normal dashboard behavior for admins)
    for (let i = 1; i <= requestCount; i++) {
      const response = await request(app)
        .get('/api/notifications/unread')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 429) {
        response429Count++;
        if (firstFailureAt === -1) {
          firstFailureAt = i;
        }
      }
    }

    // EXPECTED BEHAVIOR: Dashboard endpoints should NOT return 429 during normal usage
    // On UNFIXED code, this assertion will FAIL, proving the bug exists
    // On FIXED code, this assertion will PASS, confirming the fix works
    expect(response429Count).toBe(0);
    
    // If the test fails, document the counterexample
    if (response429Count > 0) {
      console.log(`\n🐛 COUNTEREXAMPLE FOUND:`);
      console.log(`   Endpoint: /api/notifications/unread`);
      console.log(`   User Type: admin`);
      console.log(`   First 429 at request: ${firstFailureAt}`);
      console.log(`   Total 429 responses: ${response429Count}`);
      console.log(`   Expected: 0 (dashboard endpoints should not rate limit during normal usage)`);
      console.log(`   Actual: ${response429Count} (bug confirmed - dashboard endpoints are rate limited)\n`);
    }
  });

  /**
   * Test Case 3: Admin user performing rapid searches in /api/admin/users/search
   * 
   * **Bug Condition**: Admin users have a limit of 1000 requests per 15 minutes.
   * When an admin performs rapid user searches (e.g., typing in a search box with
   * real-time results), they can quickly hit this limit and receive HTTP 429,
   * making the admin interface unusable.
   * 
   * **Expected Behavior**: Dashboard endpoints should have significantly higher limits
   * (10x base limits = 10000 for admin users) to prevent disruption during normal usage.
   * 
   * **EXPECTED OUTCOME ON UNFIXED CODE**: This test will FAIL because request 1001 returns 429.
   * **EXPECTED OUTCOME ON FIXED CODE**: This test will PASS because dashboard endpoints have 10x limits.
   */
  it('should NOT return 429 when admin performs 1001 rapid searches to /api/admin/users/search (dashboard endpoint)', async () => {
    const requestCount = 1001;
    let response429Count = 0;
    let firstFailureAt = -1;

    // Simulate rapid user searches (normal dashboard behavior for admins)
    for (let i = 1; i <= requestCount; i++) {
      const response = await request(app)
        .get('/api/admin/users/search')
        .query({ q: `user${i}` })
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 429) {
        response429Count++;
        if (firstFailureAt === -1) {
          firstFailureAt = i;
        }
      }
    }

    // EXPECTED BEHAVIOR: Dashboard endpoints should NOT return 429 during normal usage
    // On UNFIXED code, this assertion will FAIL, proving the bug exists
    // On FIXED code, this assertion will PASS, confirming the fix works
    expect(response429Count).toBe(0);
    
    // If the test fails, document the counterexample
    if (response429Count > 0) {
      console.log(`\n🐛 COUNTEREXAMPLE FOUND:`);
      console.log(`   Endpoint: /api/admin/users/search`);
      console.log(`   User Type: admin`);
      console.log(`   First 429 at request: ${firstFailureAt}`);
      console.log(`   Total 429 responses: ${response429Count}`);
      console.log(`   Expected: 0 (dashboard endpoints should not rate limit during normal usage)`);
      console.log(`   Actual: ${response429Count} (bug confirmed - dashboard endpoints are rate limited)\n`);
    }
  });

  /**
   * Test Case 4: Health check endpoint polling
   * 
   * **Bug Condition**: Health check endpoints are often polled frequently by monitoring
   * systems and the dashboard itself. These should not be subject to strict rate limiting.
   * 
   * **Expected Behavior**: Dashboard endpoints like /api/health should have significantly
   * higher limits to prevent disruption during normal monitoring.
   * 
   * **EXPECTED OUTCOME ON UNFIXED CODE**: This test will FAIL because request 501 returns 429.
   * **EXPECTED OUTCOME ON FIXED CODE**: This test will PASS because dashboard endpoints have 10x limits.
   */
  it('should NOT return 429 when authenticated user makes 501 requests to /api/health (dashboard endpoint)', async () => {
    const requestCount = 501;
    let response429Count = 0;
    let firstFailureAt = -1;

    // Simulate health check polling (normal monitoring behavior)
    for (let i = 1; i <= requestCount; i++) {
      const response = await request(app)
        .get('/api/health')
        .set('Authorization', `Bearer ${authenticatedToken}`);

      if (response.status === 429) {
        response429Count++;
        if (firstFailureAt === -1) {
          firstFailureAt = i;
        }
      }
    }

    // EXPECTED BEHAVIOR: Dashboard endpoints should NOT return 429 during normal usage
    // On UNFIXED code, this assertion will FAIL, proving the bug exists
    // On FIXED code, this assertion will PASS, confirming the fix works
    expect(response429Count).toBe(0);
    
    // If the test fails, document the counterexample
    if (response429Count > 0) {
      console.log(`\n🐛 COUNTEREXAMPLE FOUND:`);
      console.log(`   Endpoint: /api/health`);
      console.log(`   User Type: authenticated`);
      console.log(`   First 429 at request: ${firstFailureAt}`);
      console.log(`   Total 429 responses: ${response429Count}`);
      console.log(`   Expected: 0 (dashboard endpoints should not rate limit during normal usage)`);
      console.log(`   Actual: ${response429Count} (bug confirmed - dashboard endpoints are rate limited)\n`);
    }
  });
});
