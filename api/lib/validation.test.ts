import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatValidationErrors } from './validation';

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
});
