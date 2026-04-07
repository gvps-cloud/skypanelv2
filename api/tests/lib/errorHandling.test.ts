import { describe, it, expect } from 'vitest';
import { createError, ErrorCodes } from '../../lib/errorHandling';

describe('errorHandling - createError', () => {
  it('should create an error with the specified code, message, and statusCode', () => {
    const error = createError(ErrorCodes.RESOURCE_NOT_FOUND, 'Resource not found', 404);

    expect(error).toEqual({
      code: 'RESOURCE_NOT_FOUND',
      message: 'Resource not found',
      statusCode: 404,
      details: undefined
    });
  });

  it('should default statusCode to 500 if not provided', () => {
    const error = createError(ErrorCodes.INTERNAL_ERROR, 'Something went wrong');

    expect(error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
      statusCode: 500,
      details: undefined
    });
  });

  it('should include details if provided', () => {
    const details = { field: 'email', reason: 'Invalid format' };
    const error = createError(ErrorCodes.VALIDATION_ERROR, 'Validation failed', 400, details);

    expect(error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      statusCode: 400,
      details: { field: 'email', reason: 'Invalid format' }
    });
  });

  it('should handle falsy details (null)', () => {
    const error = createError(ErrorCodes.INVALID_INPUT, 'Invalid input', 400, null);

    expect(error).toEqual({
      code: 'INVALID_INPUT',
      message: 'Invalid input',
      statusCode: 400,
      details: null
    });
  });

  it('should handle arbitrary error codes', () => {
    const error = createError('CUSTOM_ERROR_CODE', 'Custom message', 418);

    expect(error).toEqual({
      code: 'CUSTOM_ERROR_CODE',
      message: 'Custom message',
      statusCode: 418,
      details: undefined
    });
  });
});
