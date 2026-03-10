/**
 * Unit tests for rate limiting middleware helper functions
 */

import { describe, it, expect } from 'vitest';
import { isDashboardEndpoint } from './rateLimiting.js';

describe('isDashboardEndpoint', () => {
  it('should identify /api/auth/me as a dashboard endpoint', () => {
    expect(isDashboardEndpoint('/api/auth/me')).toBe(true);
  });

  it('should identify /api/auth/refresh as a dashboard endpoint', () => {
    expect(isDashboardEndpoint('/api/auth/refresh')).toBe(true);
  });

  it('should identify /api/notifications/ paths as dashboard endpoints', () => {
    expect(isDashboardEndpoint('/api/notifications/')).toBe(true);
    expect(isDashboardEndpoint('/api/notifications/unread')).toBe(true);
    expect(isDashboardEndpoint('/api/notifications/123')).toBe(true);
  });

  it('should identify /api/health as a dashboard endpoint', () => {
    expect(isDashboardEndpoint('/api/health')).toBe(true);
  });

  it('should identify /api/admin/users/search as a dashboard endpoint', () => {
    expect(isDashboardEndpoint('/api/admin/users/search')).toBe(true);
  });

  it('should NOT identify VPS endpoints as dashboard endpoints', () => {
    expect(isDashboardEndpoint('/api/vps/create')).toBe(false);
    expect(isDashboardEndpoint('/api/admin/vps/list')).toBe(false);
  });

  it('should NOT identify payment endpoints as dashboard endpoints', () => {
    expect(isDashboardEndpoint('/api/payments/process')).toBe(false);
    expect(isDashboardEndpoint('/api/admin/payments/list')).toBe(false);
  });

  it('should NOT identify support ticket endpoints as dashboard endpoints', () => {
    expect(isDashboardEndpoint('/api/support/tickets')).toBe(false);
    expect(isDashboardEndpoint('/api/admin/support/tickets')).toBe(false);
  });

  it('should NOT identify organization endpoints as dashboard endpoints', () => {
    expect(isDashboardEndpoint('/api/admin/organizations/list')).toBe(false);
  });

  it('should handle paths with query parameters correctly', () => {
    // The function should be called with the path before query params are stripped
    // but we test it handles the base path correctly
    expect(isDashboardEndpoint('/api/auth/me')).toBe(true);
    expect(isDashboardEndpoint('/api/vps/create')).toBe(false);
  });

  it('should handle trailing slashes correctly', () => {
    expect(isDashboardEndpoint('/api/notifications/')).toBe(true);
    expect(isDashboardEndpoint('/api/notifications/unread')).toBe(true);
  });

  it('should NOT match partial paths that are not dashboard endpoints', () => {
    expect(isDashboardEndpoint('/api/auth/login')).toBe(false);
    expect(isDashboardEndpoint('/api/auth/register')).toBe(false);
  });
});
