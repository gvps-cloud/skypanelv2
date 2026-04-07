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
  });
});
