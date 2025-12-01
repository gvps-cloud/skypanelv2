/**
 * Authentication API routes
 * Handle user registration, login, token management, etc.
 */
import { Router, type Request, type Response } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from '../services/authService.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { logActivity } from '../services/activityLogger.js';
import { query } from '../lib/database.js';

const router = Router();

/**
 * User Registration
 * POST /api/auth/register
 */
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().isLength({ min: 1 }).withMessage('First name is required'),
  body('lastName').trim().isLength({ min: 1 }).withMessage('Last name is required'),
  body('organizationName').optional().trim()
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password, firstName, lastName, organizationName } = req.body;
    
    const result = await AuthService.register({
      email,
      password,
      firstName,
      lastName,
      organizationName
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: result.user,
      token: result.token
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * User Login
 * POST /api/auth/login
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password } = req.body;
    
    const result = await AuthService.login({ email, password });

    // Log successful login
    try {
      await logActivity({
        userId: result.user.id,
        organizationId: result.user.organizationId,
        eventType: 'auth.login',
        entityType: 'user',
        entityId: result.user.id,
        message: `User ${result.user.email} logged in`,
        status: 'success',
        metadata: { email }
      }, req);
    } catch {}

    res.json({
      message: 'Login successful',
      user: result.user,
      token: result.token
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

router.post('/verify-password', authenticateToken, [
  body('password').isString().notEmpty().withMessage('Password is required')
], async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { password } = req.body as { password: string };
    const isValid = await AuthService.verifyPassword(req.user.id, password);

    if (!isValid) {
      res.status(401).json({ error: 'Incorrect password' });
      return;
    }

    res.json({ success: true });
  } catch (error: unknown) {
    console.error('Password verification error:', error);
    res.status(500).json({ error: 'Failed to verify password' });
  }
});

/**
 * User Logout
 * POST /api/auth/logout
 */
router.post('/logout', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // In a stateless JWT system, logout is handled client-side by removing the token
    // For enhanced security, you could maintain a blacklist of tokens
    if (req.user) {
      try {
        await logActivity({
          userId: req.user.id,
          organizationId: req.user.organizationId,
          eventType: 'auth.logout',
          entityType: 'user',
          entityId: req.user.id,
          message: `User ${req.user.email} logged out`,
          status: 'success'
        }, req as any);
      } catch {}
    }
    res.json({ message: 'Logout successful' });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * Verify Email
 * POST /api/auth/verify-email
 */
router.post('/verify-email', [
  body('token').notEmpty().withMessage('Verification token is required')
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { token } = req.body;
    const result = await AuthService.verifyEmail(token);

    res.json(result);
  } catch (error: any) {
    console.error('Email verification error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Request Password Reset
 * POST /api/auth/forgot-password
 */
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email } = req.body;
    const result = await AuthService.requestPasswordReset(email);

    res.json(result);
  } catch (error: any) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

/**
 * Reset Password
 * POST /api/auth/reset-password
 */
router.post('/reset-password', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, token, password } = req.body;
    const result = await AuthService.resetPassword(email, token, password);

    res.json(result);
  } catch (error: any) {
    console.error('Password reset error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Refresh Token
 * POST /api/auth/refresh
 */
router.post('/refresh', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const result = await AuthService.refreshToken(req.user.id);

    res.json(result);
  } catch (error: any) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: error.message });
  }
});

/**
 * Get Current User
 * GET /api/auth/me
 */
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    res.json({ user: req.user });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user information' });
  }
});

/**
 * Debug endpoint to test database connectivity
 * GET /api/auth/debug/user
 */
router.get('/debug/user', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Test basic user lookup
    const userResult = await query(
      'SELECT * FROM users WHERE id = $1',
      [req.user.id]
    );

    // Test table structure
    const tableResult = await query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'users' AND table_schema = 'public'`
    );

    res.json({
      user: userResult.rows[0] || null,
      userFound: userResult.rows.length > 0,
      tableStructure: tableResult.rows,
      requestUserId: req.user.id
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: 'Debug failed', details: error });
  }
});

/**
 * Update Current User Profile (extended)
 * PUT /api/auth/profile
 */
router.put(
  '/profile',
  authenticateToken,
  [
    body('firstName').optional().isString().trim().isLength({ min: 1 }),
    body('lastName').optional().isString().trim().isLength({ min: 1 }),
    body('phone').optional().isString().trim(),
    body('timezone').optional().isString().trim()
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { firstName, lastName, phone, timezone } = req.body as { 
        firstName?: string; 
        lastName?: string; 
        phone?: string; 
        timezone?: string; 
      };

      // Fetch current user to derive existing name parts
      const currentResult = await query(
        'SELECT id, email, role, name, phone, timezone FROM users WHERE id = $1',
        [req.user.id]
      );
      
      if (currentResult.rows.length === 0) {
        console.error('Profile update - User lookup failed:', {
          userId: req.user.id,
          userExists: false
        });
        res.status(404).json({ 
          error: 'User not found',
          details: 'User does not exist in database'
        });
        return;
      }

      const current = currentResult.rows[0];
      const existingFirst = (current.name || '').split(' ')[0] || '';
      const existingLast = (current.name || '').split(' ').slice(1).join(' ');
      const newFirst = typeof firstName !== 'undefined' ? firstName : existingFirst;
      const newLast = typeof lastName !== 'undefined' ? lastName : existingLast;
      const newName = `${newFirst} ${newLast}`.trim();

      // Build update query dynamically
      const updateFields = ['name = $2', 'updated_at = $3'];
      const updateValues = [req.user.id, newName, new Date().toISOString()];
      let paramIndex = 4;

      if (typeof phone !== 'undefined') {
        updateFields.push(`phone = $${paramIndex}`);
        updateValues.push(phone);
        paramIndex++;
      }
      if (typeof timezone !== 'undefined') {
        updateFields.push(`timezone = $${paramIndex}`);
        updateValues.push(timezone);
        paramIndex++;
      }

      const updateQuery = `
        UPDATE users 
        SET ${updateFields.join(', ')} 
        WHERE id = $1 
        RETURNING id, email, role, name, phone, timezone
      `;

      const updateResult = await query(updateQuery, updateValues);

      if (updateResult.rows.length === 0) {
        res.status(500).json({ error: 'Failed to update profile' });
        return;
      }

      const updated = updateResult.rows[0];

      // Get user's organization membership to include in response for consistency
      let orgMember = null;
      try {
        const orgResult = await query(
          'SELECT organization_id, role FROM organization_members WHERE user_id = $1',
          [req.user.id]
        );
        orgMember = orgResult.rows[0] || null;
  } catch {
        console.warn('organization_members table not found, skipping organization lookup');
      }

      res.json({
        user: {
          id: updated.id,
          email: updated.email,
          firstName: newFirst,
          lastName: newLast,
          phone: updated.phone,
          timezone: updated.timezone,
          role: updated.role,
          emailVerified: true,
          organizationId: orgMember?.organization_id,
          organizationRole: orgMember?.role
        }
      });
    } catch (error: any) {
      console.error('Profile update error:', error);
      res.status(500).json({ error: error.message || 'Failed to update profile' });
    }
  }
);

/**
 * Get Organization
 * GET /api/auth/organization
 * Auto-creates organization if user doesn't have one
 */
router.get('/organization', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    let organizationId = req.user.organizationId;

    // If user doesn't have an organization, create one automatically
    if (!organizationId) {
      const now = new Date().toISOString();
      const orgId = uuidv4();
      
      // Get user's name for default organization name
      const userResult = await query('SELECT name, email FROM users WHERE id = $1', [req.user.id]);
      const userName = userResult.rows[0]?.name || 'User';
      const defaultOrgName = `${userName}'s Organization`;
      const slug = defaultOrgName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + orgId.substring(0, 8);

      // Create organization
      const orgResult = await query(
        `INSERT INTO organizations (id, name, slug, owner_id, settings, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING *`,
        [orgId, defaultOrgName, slug, req.user.id, '{}', now, now]
      );

      organizationId = orgResult.rows[0].id;

      // Add user to organization as owner
      try {
        await query(
          `INSERT INTO organization_members (organization_id, user_id, role, created_at) 
           VALUES ($1, $2, $3, $4)`,
          [organizationId, req.user.id, 'owner', now]
        );
      } catch (creationError) {
        console.warn('Failed to create organization_members entry:', creationError);
      }

      // Create wallet for organization
      try {
        await query(
          `INSERT INTO wallets (id, organization_id, balance, currency, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [uuidv4(), organizationId, 0, 'USD', now, now]
        );
      } catch (walletError) {
        console.warn('Failed to create wallet:', walletError);
      }

      console.log(`Auto-created organization ${organizationId} for user ${req.user.id}`);
    }

    // Fetch organization details
    const result = await query(
      'SELECT id, name, website, address, tax_id FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    const org = result.rows[0];
    res.json({
      organization: {
        id: org.id,
        name: org.name,
        website: org.website,
        address: org.address,
        taxId: org.tax_id
      }
    });
  } catch (error: any) {
    console.error('Get organization error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch organization' });
  }
});

/**
 * Update Organization
 * PUT /api/auth/organization
 * Auto-creates organization if user doesn't have one
 */
router.put(
  '/organization',
  authenticateToken,
  [
    body('name').optional().isString().trim().isLength({ min: 1 }),
    body('website').optional().isURL().withMessage('Invalid website URL'),
    body('address').optional().isString().trim(),
    body('taxId').optional().isString().trim()
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { name, website, address, taxId } = req.body;
      let organizationId = req.user.organizationId;

      // If user doesn't have an organization, create one
      if (!organizationId) {
        const now = new Date().toISOString();
        const orgId = uuidv4();
        const orgName = name || 'My Organization';
        const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + orgId.substring(0, 8);

        // Create organization
        const orgResult = await query(
          `INSERT INTO organizations (id, name, slug, owner_id, settings, website, address, tax_id, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
           RETURNING *`,
          [orgId, orgName, slug, req.user.id, '{}', website || null, address || null, taxId || null, now, now]
        );

        organizationId = orgResult.rows[0].id;

        // Add user to organization as owner
        try {
          await query(
            `INSERT INTO organization_members (organization_id, user_id, role, created_at) 
             VALUES ($1, $2, $3, $4)`,
            [organizationId, req.user.id, 'owner', now]
          );
        } catch (error) {
          console.warn('Failed to create organization_members entry:', error);
        }

        // Create wallet for organization
        try {
          await query(
            `INSERT INTO wallets (id, organization_id, balance, currency, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [uuidv4(), organizationId, 0, 'USD', now, now]
          );
        } catch (error) {
          console.warn('Failed to create wallet:', error);
        }

        const org = orgResult.rows[0];
        res.json({
          organization: {
            id: org.id,
            name: org.name,
            website: org.website,
            address: org.address,
            taxId: org.tax_id
          }
        });
        return;
      }

      // Update existing organization
      const fields: string[] = [];
      const values: (string | null | undefined)[] = [];
      let idx = 1;
      if (typeof name !== 'undefined') { fields.push(`name = $${idx++}`); values.push(name); }
      if (typeof website !== 'undefined') { fields.push(`website = $${idx++}`); values.push(website); }
      if (typeof address !== 'undefined') { fields.push(`address = $${idx++}`); values.push(address); }
      if (typeof taxId !== 'undefined') { fields.push(`tax_id = $${idx++}`); values.push(taxId); }
      fields.push(`updated_at = $${idx++}`); values.push(new Date().toISOString());

      const updateSql = `UPDATE organizations SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, website, address, tax_id`;
      values.push(organizationId);

      const updatedResult = await query(updateSql, values);
      if (updatedResult.rows.length === 0) {
        res.status(500).json({ error: 'Failed to update organization' });
        return;
      }

      const updated = updatedResult.rows[0];
      res.json({
        organization: {
          id: updated.id,
          name: updated.name,
          website: updated.website,
          address: updated.address,
          taxId: updated.tax_id
        }
      });
    } catch (error: unknown) {
      console.error('Organization update error:', error);
      const err = error as Error;
      res.status(500).json({ error: err.message || 'Failed to update organization' });
    }
  }
);

/**
 * Change Password
 * PUT /api/auth/password
 */
router.put(
  '/password',
  authenticateToken,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { currentPassword, newPassword } = req.body;

      // Verify current password using AuthService
      try {
        await AuthService.login({ email: req.user.email, password: currentPassword });
  } catch {
        res.status(400).json({ error: 'Current password is incorrect' });
        return;
      }

      // Update password
  await AuthService.changePassword(req.user.id, newPassword);
      
      res.json({ message: 'Password changed successfully' });
    } catch (error: any) {
      console.error('Password change error:', error);
      res.status(500).json({ error: error.message || 'Failed to change password' });
    }
  }
);

/**
 * Update Notification Preferences
 * PUT /api/auth/preferences
 */
router.put(
  '/preferences',
  authenticateToken,
  [
    body('notifications').optional().isObject(),
    body('security').optional().isObject()
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { notifications, security } = req.body;

      // Get current preferences from PostgreSQL
      const currentRes = await query('SELECT preferences FROM users WHERE id = $1', [req.user.id]);
      const currentPrefs = currentRes.rows[0]?.preferences || {};
      const updatedPrefs = { ...currentPrefs };

      if (notifications) {
        updatedPrefs.notifications = { ...currentPrefs.notifications, ...notifications };
      }
      if (security) {
        updatedPrefs.security = { ...currentPrefs.security, ...security };
      }

      const prefUpdate = await query(
        'UPDATE users SET preferences = $1, updated_at = $2 WHERE id = $3 RETURNING id',
        [updatedPrefs, new Date().toISOString(), req.user.id]
      );
      if (prefUpdate.rowCount === 0) {
        res.status(500).json({ error: 'Failed to update preferences' });
        return;
      }

      res.json({ 
        message: 'Preferences updated successfully',
        preferences: updatedPrefs
      });
    } catch (error: any) {
      console.error('Preferences update error:', error);
      res.status(500).json({ error: error.message || 'Failed to update preferences' });
    }
  }
);

/**
 * Get User API Keys
 * GET /api/auth/api-keys
 */
router.get('/api-keys', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const apiKeysRes = await query(
      `SELECT id,
              key_name AS name,
              key_prefix AS key_preview,
              created_at,
              last_used_at,
              expires_at,
              active
       FROM user_api_keys
       WHERE user_id = $1 AND active = TRUE
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ apiKeys: apiKeysRes.rows || [] });
  } catch (error: any) {
    console.error('API keys fetch error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch API keys' });
  }
});

/**
 * Generate New API Key
 * POST /api/auth/api-keys
 */
router.post(
  '/api-keys',
  authenticateToken,
  [
    body('name').isString().trim().isLength({ min: 1 }).withMessage('API key name is required')
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { name } = req.body;

      // Generate API key
      const apiKey = `sk_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
      const keyPrefix = apiKey.substring(0, 12) + '...';
      
      // Hash the key for storage (in production, use proper hashing)
      const keyHash = Buffer.from(apiKey).toString('base64');

      // Introspect schema to handle legacy 'name' column vs new 'key_name'
      const columnsCheck = await query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_name = 'user_api_keys'
           AND column_name IN ('name', 'key_name')`
      );
      const colNames: string[] = (columnsCheck.rows || []).map((r: any) => r.column_name);
      const hasLegacyName = colNames.includes('name');
      const hasKeyName = colNames.includes('key_name');

      const baseCols = ['user_id', 'key_hash', 'key_prefix', 'created_at', 'active'];
      const baseVals = [req.user.id, keyHash, keyPrefix, new Date().toISOString(), true];
      let insertCols = [...baseCols];
      let insertVals = [...baseVals];

      if (hasLegacyName && hasKeyName) {
        insertCols = ['user_id', 'name', 'key_name', 'key_hash', 'key_prefix', 'created_at', 'active'];
        insertVals = [req.user.id, name, name, keyHash, keyPrefix, new Date().toISOString(), true];
      } else if (hasLegacyName && !hasKeyName) {
        insertCols = ['user_id', 'name', 'key_hash', 'key_prefix', 'created_at', 'active'];
        insertVals = [req.user.id, name, keyHash, keyPrefix, new Date().toISOString(), true];
      } else {
        // Default to modern schema with key_name
        insertCols = ['user_id', 'key_name', 'key_hash', 'key_prefix', 'created_at', 'active'];
        insertVals = [req.user.id, name, keyHash, keyPrefix, new Date().toISOString(), true];
      }

      const placeholders = insertVals.map((_, i) => `$${i + 1}`).join(', ');
      const insertSQL = `INSERT INTO user_api_keys (${insertCols.join(', ')})
                         VALUES (${placeholders})
                         RETURNING id,
                                   key_name AS name,
                                   key_prefix AS key_preview,
                                   created_at`;

      const insertRes = await query(insertSQL, insertVals);
      if (insertRes.rows.length === 0) {
        res.status(500).json({ error: 'Failed to create API key' });
        return;
      }

      const newKey = insertRes.rows[0];
      // Log API key creation
      try {
        await logActivity({
          userId: req.user.id,
          organizationId: req.user.organizationId,
          eventType: 'api_key.create',
          entityType: 'api_key',
          entityId: newKey.id,
          message: `Created API key '${newKey.name}'`,
          status: 'success',
          metadata: { key_preview: newKey.key_preview }
        }, req as any);
      } catch {}
      res.status(201).json({
        message: 'API key created successfully',
        apiKey: {
          ...newKey,
          key: apiKey
        }
      });
    } catch (error: any) {
      console.error('API key creation error:', error);
      // Provide clearer errors for common schema issues
      const msg = (error?.message || '').toLowerCase();
      if (msg.includes('null value in column') && msg.includes('violates not-null constraint')) {
        res.status(500).json({
          error: 'Database schema mismatch detected for user_api_keys. Please apply migrations or run scripts to update the table.',
          details: error.message
        });
        return;
      }
      if (msg.includes('relation') && msg.includes('does not exist')) {
        res.status(500).json({
          error: 'user_api_keys table is missing. Apply migrations or run fix-schema script.',
          details: error.message
        });
        return;
      }
      res.status(500).json({ error: error.message || 'Failed to create API key' });
    }
  }
);

/**
 * Revoke API Key
 * DELETE /api/auth/api-keys/:id
 */
router.delete('/api-keys/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    const revokeRes = await query(
      'UPDATE user_api_keys SET active = FALSE, updated_at = $1 WHERE id = $2 AND user_id = $3',
      [new Date().toISOString(), id, req.user.id]
    );
    if (revokeRes.rowCount === 0) {
      res.status(404).json({ error: 'API key not found' });
      return;
    }
    // Log API key revocation
    try {
      await logActivity({
        userId: req.user.id,
        organizationId: req.user.organizationId,
        eventType: 'api_key.revoke',
        entityType: 'api_key',
        entityId: id,
        message: `Revoked API key '${id}'`,
        status: 'success'
      }, req as any);
    } catch {}
    res.json({ message: 'API key revoked successfully' });
  } catch (error: any) {
    console.error('API key revocation error:', error);
    res.status(500).json({ error: error.message || 'Failed to revoke API key' });
  }
});

export default router;
