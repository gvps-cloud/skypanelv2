import bcrypt from 'bcryptjs';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { randomInt } from 'crypto';
import { query, transaction } from '../lib/database.js';
import { config } from '../config/index.js';
import { v4 as uuidv4 } from 'uuid';
import { generateUniqueOrgName } from '../lib/animalSuffix.js';
import {
  sendPasswordResetEmail,
  sendWelcomeEmail
} from './emailService.js';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginData {
  email: string;
  password: string;
  code?: string; // 2FA code
}

const RESET_CODE_LENGTH = 8;

function generatePasswordResetCode(): string {
  const maxValue = 10 ** RESET_CODE_LENGTH;
  return randomInt(0, maxValue).toString().padStart(RESET_CODE_LENGTH, '0');
}

/**
 * Validate password strength requirements
 *
 * Requirements:
 * - Minimum 8 characters
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one number
 * - At least one special character
 *
 * @param password - Password to validate
 * @throws Error if password doesn't meet requirements
 */
function validatePasswordStrength(password: string): void {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  if (!hasLowercase) {
    throw new Error('Password must contain at least one lowercase letter');
  }
  if (!hasUppercase) {
    throw new Error('Password must contain at least one uppercase letter');
  }
  if (!hasNumber) {
    throw new Error('Password must contain at least one number');
  }
  if (!hasSpecial) {
    throw new Error('Password must contain at least one special character');
  }
}

export class AuthService {
  static async register(data: RegisterData) {
    try {
      // Validate password strength
      validatePasswordStrength(data.password);

      // Check if user already exists
      const existingUserResult = await query(
        'SELECT id FROM users WHERE email = $1',
        [data.email]
      );

      if (existingUserResult.rows.length > 0) {
        throw new Error('User already exists with this email');
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(data.password, saltRounds);

      // Use transaction to ensure data consistency
      const result = await transaction(async (client) => {
        const userId = uuidv4();
        const now = new Date().toISOString();

        // Create user
        const userResult = await client.query(
          `INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) 
           RETURNING *`,
          [userId, data.email, hashedPassword, `${data.firstName} ${data.lastName}`, 'user', now, now]
        );

        const user = userResult.rows[0];
        let organizationId = null;
        let finalOrgName = '';

        // Create organization with unique name (append suffix if name already exists)
        {
          const baseName = `${data.firstName}'s Workspace`;
          const { finalName } = await generateUniqueOrgName(baseName);
          finalOrgName = finalName;
          const orgId = uuidv4();
          const slug = finalName.toLowerCase().replace(/[^a-z0-9]/g, '-');

          const orgResult = await client.query(
            `INSERT INTO organizations (id, name, slug, owner_id, settings, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING *`,
            [orgId, finalName, slug, userId, '{}', now, now]
          );

          organizationId = orgResult.rows[0].id;

          // Add user to organization as owner (if organization_members table exists)
          try {
            // Query for the owner role_id from organization_roles
            const ownerRoleResult = await client.query(
              `SELECT id FROM organization_roles WHERE organization_id = $1 AND name = 'owner'`,
              [organizationId]
            );

            if (ownerRoleResult.rows.length === 0) {
              throw new Error('Owner role not found for organization');
            }

            const ownerRoleId = ownerRoleResult.rows[0].id;

            // Insert with both role_id (new) and role (legacy) columns
            await client.query(
              `INSERT INTO organization_members (organization_id, user_id, role, role_id, created_at) 
               VALUES ($1, $2, $3, $4, $5)`,
              [organizationId, userId, 'owner', ownerRoleId, now]
            );
          } catch (err) {
            // Table might not exist yet, continue without error
            console.warn('organization_members table not found, skipping member creation', err);
          }

          // Create wallet for organization
          try {
            await client.query(
              `INSERT INTO wallets (id, organization_id, balance, currency, created_at, updated_at) 
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [uuidv4(), organizationId, 0, 'USD', now, now]
            );
          } catch (err) {
            // Table might not exist yet, continue without error
            console.warn('wallets table not found, skipping wallet creation', err);
          }
        }

        return { user, organizationId, organizationName: finalOrgName };
      });

      // Generate JWT token (include role for rate limiting user type detection)
      const token = jwt.sign(
        { userId: result.user.id, email: result.user.email, role: result.user.role },
        config.JWT_SECRET as Secret,
        { expiresIn: config.JWT_EXPIRES_IN } as SignOptions
      );

      const fullName = `${data.firstName} ${data.lastName}`.trim();

      try {
        await sendWelcomeEmail(
          result.user.email,
          fullName.length > 0 ? fullName : undefined
        );
      } catch (emailError) {
        console.error('Welcome email send failed:', emailError);
      }

      return {
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.name.split(' ')[0] || '',
          lastName: result.user.name.split(' ').slice(1).join(' ') || '',
          role: result.user.role,
          emailVerified: true,
          organizationId: result.organizationId,
          organizationRole: 'owner',
          preferences: {},
          twoFactorEnabled: false
        },
        token
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  static async login(data: LoginData) {
    try {
      // Get user by email (case-insensitive to handle legacy mixed-case emails)
      const userResult = await query(
        'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
        [data.email]
      );

      if (userResult.rows.length === 0) {
        throw new Error('Invalid email or password');
      }

      const user = userResult.rows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(data.password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }

      // Check if 2FA is enabled
      if (user.two_factor_enabled) {
        // If 2FA is enabled but no code provided, tell client to ask for it
        if (!data.code) {
          return { require2fa: true };
        }

        // Verify the provided code
        if (!user.two_factor_secret) {
          // Should not happen if enabled is true, but safety check
          throw new Error('2FA configuration error');
        }

        const isValidToken = authenticator.verify({
          token: data.code,
          secret: user.two_factor_secret
        });

        if (!isValidToken) {
          throw new Error('Invalid authentication code');
        }
      }

      // Get user's organization (if organization_members table exists)
      let orgMember = null;
      let activeOrgMember = null;
      try {
        const orgResult = await query(
          'SELECT organization_id, role FROM organization_members WHERE user_id = $1',
          [user.id]
        );
        
        // Get the first organization membership (fallback)
        orgMember = orgResult.rows[0] || null;
        
        // If user has an active_organization_id, find that specific membership
        if (user.active_organization_id) {
          activeOrgMember = orgResult.rows.find(
            (row: any) => row.organization_id === user.active_organization_id
          );
        }
      } catch (err) {
        // Table might not exist yet, continue without error
        console.warn('organization_members table not found, skipping organization lookup', err);
      }

      // Determine the active organization ID and role
      const activeOrgId = user.active_organization_id && activeOrgMember 
        ? user.active_organization_id 
        : orgMember?.organization_id;
      const activeOrgRole = user.active_organization_id && activeOrgMember
        ? activeOrgMember.role
        : orgMember?.role;

      // Generate JWT token (include role for rate limiting user type detection)
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        config.JWT_SECRET as Secret,
        { expiresIn: config.JWT_EXPIRES_IN } as SignOptions
      );

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.name ? user.name.split(' ')[0] || '' : '',
          lastName: user.name ? user.name.split(' ').slice(1).join(' ') || '' : '',
          phone: user.phone,
          timezone: user.timezone,
          role: user.role,
          emailVerified: true,
          organizationId: activeOrgId,
          organizationRole: activeOrgRole,
          preferences: user.preferences,
          twoFactorEnabled: user.two_factor_enabled || false
        },
        token
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  static async verifyPassword(userId: string, password: string): Promise<boolean> {
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const hash = result.rows[0].password_hash as string;
    return bcrypt.compare(password, hash);
  }

  static async verifyEmail(token: string) {
    try {
      void token;
      // Since we don't have email verification in the current schema,
      // we'll just return success for now
      return { message: 'Email verification not implemented in current schema' };
    } catch (error) {
      console.error('Email verification error:', error);
      throw error;
    }
  }

  static async requestPasswordReset(email: string) {
    try {
      // Log password reset request for security monitoring
      console.info('Password reset requested for email:', {
        email: email.toLowerCase(),
        timestamp: new Date().toISOString(),
        codeLength: RESET_CODE_LENGTH
      });

      const result = await query(
        'SELECT id, name FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        // Don't reveal if email exists (security best practice)
        console.info('Password reset requested for non-existent email:', {
          email: email.toLowerCase(),
          timestamp: new Date().toISOString()
        });
        return { message: 'If the email exists, a reset link has been sent' };
      }

      const user = result.rows[0];

      // Generate a fixed-length numeric code that matches the reset UI/email copy.
      const resetToken = generatePasswordResetCode();
      const resetExpires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now

      console.info('Generated password reset token for user:', {
        userId: user.id,
        codeLength: resetToken.length,
        expiresAt: resetExpires.toISOString(),
        timestamp: new Date().toISOString()
      });

      // Store reset token in database
      await query(
        'UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3',
        [resetToken, resetExpires.toISOString(), user.id]
      );

      try {
        await sendPasswordResetEmail(
          email,
          resetToken,
          user.name || undefined
        );
        console.info('Password reset email sent successfully:', {
          userId: user.id,
          email: email.toLowerCase(),
          timestamp: new Date().toISOString()
        });
      } catch (emailError) {
        console.error('Password reset email send failed:', {
          userId: user.id,
          email: email.toLowerCase(),
          error: emailError,
          timestamp: new Date().toISOString()
        });
        // Still return success to avoid leaking email existence
      }

      // Never return the token - user must check their email
      // This prevents security issues and ensures proper verification flow
      return {
        message: 'If the email exists, a reset link has been sent'
      };
    } catch (error) {
      console.error('Password reset request error:', {
        email: email.toLowerCase(),
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  static async resetPassword(email: string, token: string, newPassword: string) {
    try {
      const normalizedToken = token.trim();
      const normalizedEmail = email.toLowerCase().trim();

      if (!/^\d{8}$/.test(normalizedToken)) {
        throw new Error('Reset code must be exactly 8 digits');
      }

      // Log password reset attempt for security monitoring
      console.info('Password reset attempt:', {
        email: normalizedEmail,
        codeLength: normalizedToken.length,
        timestamp: new Date().toISOString()
      });

      // Find user with valid reset token AND matching email
      const userResult = await query(
        'SELECT id, email FROM users WHERE reset_token = $1 AND reset_expires > NOW() AND LOWER(email) = $2',
        [normalizedToken, normalizedEmail]
      );

      if (userResult.rows.length === 0) {
        console.warn('Password reset failed: Invalid or expired token', {
          email: normalizedEmail,
          timestamp: new Date().toISOString()
        });
        throw new Error('Invalid or expired reset code, or email does not match');
      }

      const user = userResult.rows[0];

      // Hash the new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password and clear reset token
      await query(
        'UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL, updated_at = $2 WHERE id = $3',
        [hashedPassword, new Date().toISOString(), user.id]
      );

      console.info('Password reset successful:', {
        userId: user.id,
        email: user.email,
        timestamp: new Date().toISOString()
      });

      return { message: 'Password reset successfully' };
    } catch (error) {
      console.error('Password reset error:', {
        email: email.toLowerCase(),
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  static async refreshToken(userId: string) {
    try {
      const userResult = await query(
        'SELECT id, email, role, name, phone, timezone, preferences, two_factor_enabled, active_organization_id FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];

      // Get user's organization membership
      let orgMember = null;
      let activeOrgMember = null;
      try {
        const orgResult = await query(
          'SELECT organization_id, role FROM organization_members WHERE user_id = $1',
          [user.id]
        );
        
        // Get the first organization membership (fallback)
        orgMember = orgResult.rows[0] || null;
        
        // If user has an active_organization_id, find that specific membership
        if (user.active_organization_id) {
          activeOrgMember = orgResult.rows.find(
            (row: any) => row.organization_id === user.active_organization_id
          );
        }
      } catch (err) {
        console.warn('organization_members table not found, skipping organization lookup', err);
      }

      // Determine the active organization ID and role
      let activeOrgId = null;
      let activeOrgRole = null;
      
      if (user.active_organization_id && activeOrgMember) {
        // User has a valid active organization
        activeOrgId = user.active_organization_id;
        activeOrgRole = activeOrgMember.role;
      } else if (user.active_organization_id && !activeOrgMember) {
        // User has an active_organization_id but is no longer a member - clear it
        await query(
          'UPDATE users SET active_organization_id = NULL WHERE id = $1',
          [user.id]
        );
        // Fall back to first organization membership if available
        activeOrgId = orgMember?.organization_id;
        activeOrgRole = orgMember?.role;
      } else {
        // No active organization set, use first membership if available
        activeOrgId = orgMember?.organization_id;
        activeOrgRole = orgMember?.role;
      }

      // Generate new JWT token (include role for rate limiting user type detection)
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        config.JWT_SECRET as Secret,
        { expiresIn: config.JWT_EXPIRES_IN } as SignOptions
      );

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.name ? user.name.split(' ')[0] || '' : '',
          lastName: user.name ? user.name.split(' ').slice(1).join(' ') || '' : '',
          phone: user.phone,
          timezone: user.timezone,
          role: user.role,
          emailVerified: true,
          organizationId: activeOrgId,
          organizationRole: activeOrgRole,
          preferences: user.preferences,
          twoFactorEnabled: user.two_factor_enabled || false
        }
      };
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }

  static async changePassword(userId: string, newPassword: string) {
    try {
      // Hash the new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password in database
      const result = await query(
        'UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3',
        [hashedPassword, new Date().toISOString(), userId]
      );

      if (result.rowCount === 0) {
        throw new Error('User not found');
      }

      return { success: true };
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }

  static async setup2FA(userId: string) {
    try {
      const userResult = await query('SELECT email FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) throw new Error('User not found');

      const user = userResult.rows[0];
      const secret = authenticator.generateSecret();
      const otpauth = authenticator.keyuri(user.email, config.COMPANY_BRAND_NAME, secret);
      const qrCode = await QRCode.toDataURL(otpauth);

      await query('UPDATE users SET two_factor_secret = $1 WHERE id = $2', [secret, userId]);

      return { secret, qrCode };
    } catch (error) {
      console.error('Setup 2FA error:', error);
      throw error;
    }
  }

  static async verify2FASetup(userId: string, token: string) {
    try {
      const result = await query('SELECT two_factor_secret FROM users WHERE id = $1', [userId]);
      if (result.rows.length === 0) throw new Error('User not found');

      const secret = result.rows[0].two_factor_secret;
      if (!secret) throw new Error('2FA not initialized');

      const isValid = authenticator.verify({ token, secret });
      if (!isValid) throw new Error('Invalid OTP code');

      await query('UPDATE users SET two_factor_enabled = TRUE WHERE id = $1', [userId]);

      return { success: true };
    } catch (error) {
      console.error('Verify 2FA setup error:', error);
      throw error;
    }
  }

  static async verifyTwoFactorCode(userId: string, token: string) {
    try {
      const result = await query(
        "SELECT two_factor_enabled, two_factor_secret FROM users WHERE id = $1",
        [userId],
      );

      if (result.rows.length === 0) {
        throw new Error("User not found");
      }

      const user = result.rows[0];

      if (!user.two_factor_enabled) {
        return { success: true, required: false };
      }

      if (!token?.trim()) {
        throw new Error("Two-factor authentication code is required");
      }

      if (!user.two_factor_secret) {
        throw new Error("2FA configuration error");
      }

      const isValid = authenticator.verify({
        token: token.trim(),
        secret: user.two_factor_secret,
      });

      if (!isValid) {
        throw new Error("Invalid authentication code");
      }

      return { success: true, required: true };
    } catch (error) {
      console.error("Verify 2FA code error:", error);
      throw error;
    }
  }

  static async disable2FA(userId: string) {
    try {
      await query(
        'UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL WHERE id = $1',
        [userId]
      );
      return { success: true };
    } catch (error) {
      console.error('Disable 2FA error:', error);
      throw error;
    }
  }
}