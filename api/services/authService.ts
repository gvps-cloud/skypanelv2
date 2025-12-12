import bcrypt from 'bcryptjs';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { randomBytes } from 'crypto';
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

const RESET_TOKEN_LENGTH = 8;

export class AuthService {
  static async register(data: RegisterData) {
    try {
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
            await client.query(
              `INSERT INTO organization_members (organization_id, user_id, role, created_at) 
               VALUES ($1, $2, $3, $4)`,
              [organizationId, userId, 'owner', now]
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
      // Get user by email
      const userResult = await query(
        'SELECT * FROM users WHERE email = $1',
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
      try {
        const orgResult = await query(
          'SELECT organization_id, role FROM organization_members WHERE user_id = $1',
          [user.id]
        );
        orgMember = orgResult.rows[0] || null;
      } catch (err) {
        // Table might not exist yet, continue without error
        console.warn('organization_members table not found, skipping organization lookup', err);
      }

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
      const result = await query(
        'SELECT id, name FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        // Don't reveal if email exists (security best practice)
        return { message: 'If the email exists, a reset link has been sent' };
      }

      const user = result.rows[0];

      // Generate a secure, short reset token suitable for OTP entry
      const resetToken = randomBytes(RESET_TOKEN_LENGTH)
        .toString('hex')
        .slice(0, RESET_TOKEN_LENGTH)
        .toUpperCase();
      const resetExpires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now

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
      } catch (emailError) {
        console.error('Password reset email send failed:', emailError);
        // Still return success to avoid leaking email existence
      }

      // Never return the token - user must check their email
      // This prevents security issues and ensures proper verification flow
      return {
        message: 'If the email exists, a reset link has been sent'
      };
    } catch (error) {
      console.error('Password reset request error:', error);
      throw error;
    }
  }

  static async resetPassword(email: string, token: string, newPassword: string) {
    try {
      const normalizedToken = token.toUpperCase();
      const normalizedEmail = email.toLowerCase().trim();

      // Find user with valid reset token AND matching email
      const userResult = await query(
        'SELECT id, email FROM users WHERE reset_token = $1 AND reset_expires > NOW() AND LOWER(email) = $2',
        [normalizedToken, normalizedEmail]
      );

      if (userResult.rows.length === 0) {
        throw new Error('Invalid or expired reset token, or email does not match');
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

      return { message: 'Password reset successfully' };
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  }

  static async refreshToken(userId: string) {
    try {
      const userResult = await query(
        'SELECT id, email, role, name, phone, timezone, preferences, two_factor_enabled FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];

      // Get user's organization membership
      let orgMember = null;
      try {
        const orgResult = await query(
          'SELECT organization_id, role FROM organization_members WHERE user_id = $1',
          [user.id]
        );
        orgMember = orgResult.rows[0] || null;
      } catch (err) {
        console.warn('organization_members table not found, skipping organization lookup', err);
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
          organizationId: orgMember?.organization_id,
          organizationRole: orgMember?.role,
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
      const otpauth = authenticator.keyuri(user.email, 'SkyPanelV2', secret);
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