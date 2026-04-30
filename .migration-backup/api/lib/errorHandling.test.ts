import { describe, it, expect } from 'vitest';
import { createError, ErrorCodes } from './errorHandling';

describe('errorHandling', () => {
  describe('createError', () => {
    it('should create a structured error with all provided parameters', () => {
      const code = ErrorCodes.VALIDATION_ERROR;
      const message = 'Invalid input provided';
      const statusCode = 400;
      const details = { field: 'email', error: 'must be valid email' };

      const error = createError(code, message, statusCode, details);

      expect(error).toEqual({
        code,
        message,
        statusCode,
        details,
      });
    });

    it('should create a structured error with default statusCode 500 when omitted', () => {
      const code = ErrorCodes.INTERNAL_ERROR;
      const message = 'Something went wrong';

      const error = createError(code, message);

      expect(error).toEqual({
        code,
        message,
        statusCode: 500,
        details: undefined,
      });
    });

    it('should accept RESOURCE_NOT_FOUND with a 404 status', () => {
      const error = createError(ErrorCodes.RESOURCE_NOT_FOUND, 'Resource not found', 404);

      expect(error).toEqual({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Resource not found',
        statusCode: 404,
        details: undefined,
      });
    });

    it('should preserve null details when explicitly provided', () => {
      const error = createError(ErrorCodes.INVALID_INPUT, 'Invalid input', 400, null);

      expect(error).toEqual({
        code: 'INVALID_INPUT',
        message: 'Invalid input',
        statusCode: 400,
        details: null,
      });
    });

    it('should accept arbitrary string error codes', () => {
      const error = createError('CUSTOM_ERROR_CODE', 'Custom message', 418);

      expect(error).toEqual({
        code: 'CUSTOM_ERROR_CODE',
        message: 'Custom message',
        statusCode: 418,
        details: undefined,
      });
    });
  });
});
