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

  it('should handle falsy values for fields correctly', () => {
    const errors = [
      { path: '', param: '', msg: '', value: null }, // Empty strings should fall back
      { path: null, param: null, msg: null, value: false } // nulls should fall back
    ];

    const result = formatValidationErrors(errors);

    expect(result.errors).toEqual([
      { field: 'unknown', message: 'Invalid value', value: null },
      { field: 'unknown', message: 'Invalid value', value: false }
    ]);
  });

  it('should prefer "path" over "param"', () => {
    const errors = [
      { path: 'preferredPath', param: 'ignoredParam', msg: 'Some message' }
    ];

    const result = formatValidationErrors(errors);

    expect(result.errors).toEqual([
      { field: 'preferredPath', message: 'Some message', value: undefined }
    ]);
  });

  it('should throw an error for unhandled null or undefined array items', () => {
    const errors = [undefined, null] as any[];

    // Ensure the current unhandled behavior is captured in the test.
    expect(() => formatValidationErrors(errors)).toThrow();
  });

  it('should correctly handle a mix of errors with varying structures', () => {
    const errors = [
      { path: 'id', msg: 'Missing ID', value: 123 },
      { param: 'name', msg: 'Invalid name' },
      { value: 'orphaned value' },
      { path: 'email', value: 'test@example' }, // missing msg
      { msg: 'Global error' } // missing path/param and value
    ];

    const result = formatValidationErrors(errors);

    expect(result.errors).toEqual([
      { field: 'id', message: 'Missing ID', value: 123 },
      { field: 'name', message: 'Invalid name', value: undefined },
      { field: 'unknown', message: 'Invalid value', value: 'orphaned value' },
      { field: 'email', message: 'Invalid value', value: 'test@example' },
      { field: 'unknown', message: 'Global error', value: undefined }
    ]);
  });

  it('should not mutate the original errors array', () => {
    const originalErrors = [
      { path: 'test', msg: 'error msg', value: 'test val' }
    ];
    const originalErrorsCopy = JSON.parse(JSON.stringify(originalErrors));

    formatValidationErrors(originalErrors);

    expect(originalErrors).toEqual(originalErrorsCopy);
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

  it('should format a basic business logic error', () => {
    const result = formatBusinessLogicError('Resource not found');

    expect(result).toEqual({
      error: 'Resource not found',
      code: 'BUSINESS_LOGIC_ERROR',
      timestamp: '2024-01-01T12:00:00.000Z'
    });
  });

  it('should accept a custom error code', () => {
    const result = formatBusinessLogicError('Payment declined', 'PAYMENT_ERROR');

    expect(result).toEqual({
      error: 'Payment declined',
      code: 'PAYMENT_ERROR',
      timestamp: '2024-01-01T12:00:00.000Z'
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

  it('should format a basic server error', () => {
    const result = formatServerError('Database connection failed');

    expect(result).toEqual({
      error: 'Database connection failed',
      code: 'INTERNAL_SERVER_ERROR',
      timestamp: '2024-01-01T12:00:00.000Z'
    });
  });

  it('should accept a custom error code', () => {
    const result = formatServerError('Redis timeout', 'CACHE_TIMEOUT');

    expect(result).toEqual({
      error: 'Redis timeout',
      code: 'CACHE_TIMEOUT',
      timestamp: '2024-01-01T12:00:00.000Z'
    });
  });
});
