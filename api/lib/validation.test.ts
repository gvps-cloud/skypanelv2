import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatValidationErrors, formatBusinessLogicError, formatServerError, ValidationPatterns } from './validation';

describe('ValidationPatterns', () => {
  describe('email', () => {
    it('should match valid emails', () => {
      expect(ValidationPatterns.email.test('test@example.com')).toBe(true);
      expect(ValidationPatterns.email.test('user.name+tag@domain.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(ValidationPatterns.email.test('invalid-email')).toBe(false);
      expect(ValidationPatterns.email.test('@domain.com')).toBe(false);
      expect(ValidationPatterns.email.test('test@')).toBe(false);
      expect(ValidationPatterns.email.test('test@domain')).toBe(false);
    });
  });

  describe('slug', () => {
    it('should match valid slugs', () => {
      expect(ValidationPatterns.slug.test('valid-slug-123')).toBe(true);
      expect(ValidationPatterns.slug.test('slug')).toBe(true);
      expect(ValidationPatterns.slug.test('123-456')).toBe(true);
    });

    it('should reject invalid slugs', () => {
      expect(ValidationPatterns.slug.test('Invalid-Slug')).toBe(false);
      expect(ValidationPatterns.slug.test('slug with spaces')).toBe(false);
      expect(ValidationPatterns.slug.test('slug_with_underscores')).toBe(false);
      expect(ValidationPatterns.slug.test('slug!@#')).toBe(false);
    });
  });

  describe('phone', () => {
    it('should match valid phone numbers', () => {
      expect(ValidationPatterns.phone.test('+1234567890')).toBe(true);
      expect(ValidationPatterns.phone.test('1234567890')).toBe(true);
      expect(ValidationPatterns.phone.test('1')).toBe(true);
      expect(ValidationPatterns.phone.test('+123456789012345')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(ValidationPatterns.phone.test('phone')).toBe(false);
      expect(ValidationPatterns.phone.test('++123')).toBe(false);
      expect(ValidationPatterns.phone.test('123-456-7890')).toBe(false);
      expect(ValidationPatterns.phone.test('123 456 7890')).toBe(false);
      expect(ValidationPatterns.phone.test('+12345678901234567')).toBe(false); // Too long
    });
  });

  describe('timezone', () => {
    it('should match valid timezones', () => {
      expect(ValidationPatterns.timezone.test('America/New_York')).toBe(true);
      expect(ValidationPatterns.timezone.test('Europe/London')).toBe(true);
      expect(ValidationPatterns.timezone.test('Asia/Tokyo')).toBe(true);
      expect(ValidationPatterns.timezone.test('UTC/GMT')).toBe(true);
    });

    it('should reject invalid timezones', () => {
      expect(ValidationPatterns.timezone.test('Invalid')).toBe(false);
      expect(ValidationPatterns.timezone.test('America/New York')).toBe(false);
      expect(ValidationPatterns.timezone.test('Europe/London/Extra')).toBe(false);
      expect(ValidationPatterns.timezone.test('America-New_York')).toBe(false);
    });
  });

  describe('uuid', () => {
    it('should match valid UUIDs', () => {
      expect(ValidationPatterns.uuid.test('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(ValidationPatterns.uuid.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(ValidationPatterns.uuid.test('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true); // v1
      expect(ValidationPatterns.uuid.test('00000000-0000-4000-8000-000000000000')).toBe(true); // v4 specific edge
    });

    it('should reject invalid UUIDs', () => {
      expect(ValidationPatterns.uuid.test('123e4567-e89b-12d3-a456-42661417400')).toBe(false); // Too short
      expect(ValidationPatterns.uuid.test('123e4567-e89b-12d3-a456-4266141740000')).toBe(false); // Too long
      expect(ValidationPatterns.uuid.test('invalid-uuid-string')).toBe(false);
      expect(ValidationPatterns.uuid.test('123e4567-e89b-02d3-a456-426614174000')).toBe(false); // Invalid version
      expect(ValidationPatterns.uuid.test('123e4567-e89b-12d3-7456-426614174000')).toBe(false); // Invalid variant
    });
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
    const result = formatBusinessLogicError('Custom business error');
    expect(result).toEqual({
      error: 'Custom business error',
      code: 'BUSINESS_LOGIC_ERROR',
      timestamp: '2024-01-01T12:00:00.000Z'
    });
  });

  it('should format a business logic error with custom code', () => {
    const result = formatBusinessLogicError('Custom business error', 'CUSTOM_CODE');
    expect(result).toEqual({
      error: 'Custom business error',
      code: 'CUSTOM_CODE',
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

  it('should format a server error with default code', () => {
    const result = formatServerError('Custom server error');
    expect(result).toEqual({
      error: 'Custom server error',
      code: 'INTERNAL_SERVER_ERROR',
      timestamp: '2024-01-01T12:00:00.000Z'
    });
  });

  it('should format a server error with custom code', () => {
    const result = formatServerError('Custom server error', 'CUSTOM_SERVER_CODE');
    expect(result).toEqual({
      error: 'Custom server error',
      code: 'CUSTOM_SERVER_CODE',
      timestamp: '2024-01-01T12:00:00.000Z'
    });
  });
});

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
