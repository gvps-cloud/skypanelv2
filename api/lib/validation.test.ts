import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatValidationErrors, formatBusinessLogicError, formatServerError } from './validation';

describe('formatValidationErrors', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle an empty array of errors', () => {
    const errors: any[] = [];
    const result = formatValidationErrors(errors);

    expect(result).toEqual({
      error: 'Validation failed',
      errors: [],
      code: 'VALIDATION_ERROR',
      timestamp: '2024-01-01T12:00:00.000Z'
    });
  });

  it('should correctly format typical express-validator errors with "path"', () => {
    const errors = [
      { path: 'email', msg: 'Invalid email address', value: 'bad-email' },
      { path: 'password', msg: 'Password too short', value: '123' }
    ];

    const result = formatValidationErrors(errors);

    expect(result).toEqual({
      error: 'Validation failed',
      errors: [
        { field: 'email', message: 'Invalid email address', value: 'bad-email' },
        { field: 'password', message: 'Password too short', value: '123' }
      ],
      code: 'VALIDATION_ERROR',
      timestamp: '2024-01-01T12:00:00.000Z'
    });
  });

  it('should fallback to "param" if "path" is not provided', () => {
    const errors = [
      { param: 'username', msg: 'Username is required' }
    ];

    const result = formatValidationErrors(errors);

    expect(result.errors).toEqual([
      { field: 'username', message: 'Username is required', value: undefined }
    ]);
  });

  it('should fallback to "unknown" and "Invalid value" if fields are missing', () => {
    const errors = [
      { value: 'something' }, // missing path, param, msg
      {} // missing everything
    ];

    const result = formatValidationErrors(errors);

    expect(result.errors).toEqual([
      { field: 'unknown', message: 'Invalid value', value: 'something' },
      { field: 'unknown', message: 'Invalid value', value: undefined }
    ]);
  });
  it('should handle null or undefined input gracefully (if applicable)', () => {
    // Current implementation throws if errors is undefined or null because it maps over it.
    // If this test fails, it means we should consider modifying `formatValidationErrors`
    // to handle undefined/null, but let's first test current behavior.
    expect(() => formatValidationErrors(undefined as any)).toThrow();
    expect(() => formatValidationErrors(null as any)).toThrow();
  });
});

describe('formatBusinessLogicError', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should format a business logic error with default code', () => {
    const result = formatBusinessLogicError('Resource not found');

    expect(result).toEqual({
      error: 'Resource not found',
      code: 'BUSINESS_LOGIC_ERROR',
      timestamp: '2024-01-01T12:00:00.000Z',
    });
  });

  it('should format a business logic error with custom code', () => {
    const result = formatBusinessLogicError('Insufficient funds', 'INSUFFICIENT_FUNDS');

    expect(result).toEqual({
      error: 'Insufficient funds',
      code: 'INSUFFICIENT_FUNDS',
      timestamp: '2024-01-01T12:00:00.000Z',
    });
  });
});

describe('formatServerError', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should format a server error with default code', () => {
    const result = formatServerError('Database connection failed');

    expect(result).toEqual({
      error: 'Database connection failed',
      code: 'INTERNAL_SERVER_ERROR',
      timestamp: '2024-01-01T12:00:00.000Z',
    });
  });

  it('should format a server error with custom code', () => {
    const result = formatServerError('Timeout', 'GATEWAY_TIMEOUT');

    expect(result).toEqual({
      error: 'Timeout',
      code: 'GATEWAY_TIMEOUT',
      timestamp: '2024-01-01T12:00:00.000Z',
    });
  });
});
