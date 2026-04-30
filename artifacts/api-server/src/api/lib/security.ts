/**
 * Security utilities for admin user management
 */
import type { AuthenticatedRequest } from '../middleware/auth.js';

export interface SecurityValidationResult {
  isValid: boolean;
  error?: string;
  requiresConfirmation?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Validates if an admin can impersonate a target user
 */
export const validateImpersonationRequest = (
  adminUser: any,
  targetUser: any,
  confirmAdminImpersonation: boolean = false
): SecurityValidationResult => {
  // Basic validation
  if (!adminUser || !targetUser) {
    return {
      isValid: false,
      error: 'Invalid user data provided'
    };
  }

  // Ensure admin has admin role
  if (adminUser.role !== 'admin') {
    return {
      isValid: false,
      error: 'Insufficient permissions. Admin role required.'
    };
  }

  // Prevent self-impersonation
  if (adminUser.id === targetUser.id) {
    return {
      isValid: false,
      error: 'Cannot impersonate yourself'
    };
  }

  // Admin-to-admin impersonation requires explicit confirmation
  if (targetUser.role === 'admin' && !confirmAdminImpersonation) {
    return {
      isValid: false,
      error: 'Admin-to-admin impersonation requires confirmation',
      requiresConfirmation: true,
      metadata: {
        targetUser: {
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
          role: targetUser.role
        }
      }
    };
  }

  return { isValid: true };
};

/**
 * Validates user update permissions and data
 */
export const validateUserUpdateRequest = (
  adminUser: any,
  targetUser: any,
  updateData: any
): SecurityValidationResult => {
  // Basic validation
  if (!adminUser || !targetUser) {
    return {
      isValid: false,
      error: 'Invalid user data provided'
    };
  }

  // Ensure admin has admin role
  if (adminUser.role !== 'admin') {
    return {
      isValid: false,
      error: 'Insufficient permissions. Admin role required.'
    };
  }

  // Prevent self-role modification (admin cannot demote themselves)
  if (adminUser.id === targetUser.id && updateData.role && updateData.role !== adminUser.role) {
    return {
      isValid: false,
      error: 'Cannot modify your own role'
    };
  }

  // Validate role changes
  if (updateData.role && !['admin', 'user'].includes(updateData.role)) {
    return {
      isValid: false,
      error: 'Invalid role specified'
    };
  }

  // Validate status changes
  if (updateData.status && !['active', 'inactive', 'suspended'].includes(updateData.status)) {
    return {
      isValid: false,
      error: 'Invalid status specified'
    };
  }

  return { isValid: true };
};

/**
 * Sanitizes user input to prevent injection attacks
 */
export const sanitizeUserInput = (input: any): any => {
  if (typeof input === 'string') {
    return input.trim().replace(/[<>]/g, '');
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeUserInput);
  }
  
  if (input && typeof input === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeUserInput(value);
    }
    return sanitized;
  }
  
  return input;
};



/**
 * Generates audit metadata for logging
 */
export const generateAuditMetadata = (
  req: AuthenticatedRequest,
  operation: string,
  targetEntity?: any,
  changes?: any
): Record<string, any> => {
  return {
    operation,
    admin_user_id: req.user?.id,
    admin_user_email: req.user?.email,
    target_entity_id: targetEntity?.id,
    target_entity_type: targetEntity?.constructor?.name || 'unknown',
    changes: changes || {},
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
    timestamp: new Date().toISOString(),
    request_id: req.headers['x-request-id'] || 'unknown'
  };
};