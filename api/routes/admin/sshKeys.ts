/**
 * Admin SSH Key Management Routes
 * Allows admins to view and manage SSH keys across all organizations
 */
import { Router, type Response } from 'express';
import { body, param, query as queryValidator, validationResult } from 'express-validator';
import crypto from 'crypto';
import { authenticateToken, AuthenticatedRequest, requireAdmin } from '../../middleware/auth.js';
import { query } from '../../lib/database.js';
import { decryptSecret } from '../../lib/crypto.js';
import { linodeService } from '../../services/linodeService.js';
import { logActivity } from '../../services/activityLogger.js';
import {
  withRetry,
  handleProviderError,
  validateSSHKeyFormat,
  logError,
  ErrorCodes
} from '../../lib/errorHandling.js';
import {
  getSSHKeySuccessMessage,
  getSSHKeyDeleteMessage,
  buildActivityMetadata,
  type ProviderResult
} from '../../lib/whiteLabel.js';

const router = Router();

// All routes require authentication and admin role
router.use(authenticateToken, requireAdmin);

/**
 * Build a provider-safe SSH key label using organization name, user identifier, and key name.
 */
function sanitizeLabelPart(part: string, replaceAt: boolean = false): string {
  let s = (part || '').trim();
  if (replaceAt) s = s.replace(/@/g, '_');
  s = s.replace(/\s+/g, '-');
  s = s.replace(/[^a-zA-Z0-9\-_]/g, '-');
  s = s.replace(/-+/g, '-');
  s = s.replace(/_+/g, '_');
  s = s.replace(/^-+/, '').replace(/-+$/, '');
  s = s.replace(/^_+/, '').replace(/_+$/, '');
  return s.toLowerCase();
}

async function getOrganizationName(organizationId?: string): Promise<string | null> {
  if (!organizationId) return null;
  try {
    const result = await query('SELECT name FROM organizations WHERE id = $1 LIMIT 1', [organizationId]);
    const name = result.rows[0]?.name;
    return typeof name === 'string' && name.trim().length > 0 ? name : null;
  } catch {
    return null;
  }
}

function mapSSHKeyRow(row: any) {
  return {
    id: row.id,
    organization_id: row.organization_id,
    organization_name: row.organization_name,
    name: row.name,
    public_key: row.public_key,
    fingerprint: row.fingerprint,
    linode_key_id: row.linode_key_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    creator: row.creator_id
      ? {
          id: row.creator_id,
          name: row.creator_name,
          email: row.creator_email,
        }
      : null,
  };
}

async function buildProviderKeyLabel(orgId: string | undefined, userEmail: string, userKeyName: string): Promise<string> {
  const orgName = await getOrganizationName(orgId);
  const orgPart = sanitizeLabelPart(orgName ?? (orgId ? `org-${orgId}` : 'org-unknown'));
  const userPart = sanitizeLabelPart(userEmail, true);
  const keyPart = sanitizeLabelPart(userKeyName);
  let label = `${orgPart}-${userPart}-${keyPart}`;
  if (label.length > 64) label = label.slice(0, 64);
  if (!label || !/[a-z0-9]/.test(label)) label = `key-${Date.now()}`;
  return label;
}

/**
 * Generate SSH key fingerprint from public key
 */
function generateFingerprint(publicKey: string): string {
  const parts = publicKey.trim().split(/\s+/);
  if (parts.length < 2) {
    throw new Error('Invalid SSH public key format');
  }
  const keyData = parts[1];
  const keyBuffer = Buffer.from(keyData, 'base64');
  const hash = crypto.createHash('md5').update(keyBuffer).digest('hex');
  return hash.match(/.{2}/g)?.join(':') || hash;
}

/**
 * Get provider API tokens from database
 */
async function getProviderTokens(): Promise<{ linode?: string }> {
  try {
    const result = await query(
      `SELECT type, api_key_encrypted 
       FROM service_providers 
       WHERE active = true AND type = 'linode'`
    );

    const tokens: { linode?: string } = {};

    for (const row of result.rows) {
      try {
        const decrypted = decryptSecret(row.api_key_encrypted);
        if (decrypted && decrypted.trim().length > 0) {
          if (row.type === 'linode') {
            tokens.linode = decrypted;
          }
        }
      } catch (error: any) {
        console.error(`Failed to decrypt ${row.type} API token:`, error.message);
      }
    }

    return tokens;
  } catch (error: any) {
    console.error('Error fetching provider tokens:', error.message);
    return {};
  }
}

/**
 * GET /api/admin/ssh-keys
 * Get all SSH keys across all organizations with pagination and search
 */
router.get('/', [
  queryValidator('page').optional().isInt({ min: 1 }).toInt(),
  queryValidator('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  queryValidator('search').optional().trim().isLength({ max: 255 }),
  queryValidator('organizationId').optional().isUUID(),
], async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const page = (req.query.page as any) || 1;
    const limit = (req.query.limit as any) || 25;
    const search = req.query.search as string | undefined;
    const organizationId = req.query.organizationId as string | undefined;
    const offset = (page - 1) * limit;

    // Build search conditions
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(
        usk.name ILIKE $${paramIndex} OR 
        usk.fingerprint ILIKE $${paramIndex} OR 
        o.name ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (organizationId) {
      conditions.push(`usk.organization_id = $${paramIndex}`);
      params.push(organizationId);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(DISTINCT usk.id) as total
       FROM user_ssh_keys usk
       LEFT JOIN organizations o ON o.id = usk.organization_id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    // Get SSH keys with organization and creator info
    const result = await query(
      `SELECT 
        usk.id,
        usk.organization_id,
        o.name as organization_name,
        usk.name,
        usk.public_key,
        usk.fingerprint,
        usk.linode_key_id,
        usk.created_at,
        usk.updated_at,
        u.id as creator_id,
        u.name as creator_name,
        u.email as creator_email
       FROM user_ssh_keys usk
       LEFT JOIN organizations o ON o.id = usk.organization_id
       LEFT JOIN users u ON u.id = usk.created_by_user_id
       ${whereClause}
       ORDER BY usk.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const keys = result.rows.map(mapSSHKeyRow);

    res.json({
      keys,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching admin SSH keys:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch SSH keys' });
  }
});

/**
 * GET /api/admin/ssh-keys/:keyId
 * Get a single SSH key by ID
 */
router.get('/:keyId', [
  param('keyId').isUUID(),
], async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { keyId } = req.params;

    const result = await query(
      `SELECT 
        usk.id,
        usk.organization_id,
        o.name as organization_name,
        usk.name,
        usk.public_key,
        usk.fingerprint,
        usk.linode_key_id,
        usk.created_at,
        usk.updated_at,
        u.id as creator_id,
        u.name as creator_name,
        u.email as creator_email
       FROM user_ssh_keys usk
       LEFT JOIN organizations o ON o.id = usk.organization_id
       LEFT JOIN users u ON u.id = usk.created_by_user_id
       WHERE usk.id = $1`,
      [keyId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'SSH key not found' });
      return;
    }

    res.json({ key: mapSSHKeyRow(result.rows[0]) });
  } catch (error: any) {
    console.error('Error fetching SSH key:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch SSH key' });
  }
});

/**
 * POST /api/admin/ssh-keys
 * Create a new SSH key for a specific organization (admin override)
 */
router.post('/', [
  body('organizationId').isUUID().withMessage('Organization ID is required'),
  body('name').trim().isLength({ min: 1, max: 255 }).withMessage('Name is required and must be less than 255 characters'),
  body('publicKey').trim().isLength({ min: 1 }).withMessage('Public key is required')
    .matches(/^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521)\s+[A-Za-z0-9+/=]+/)
    .withMessage('Invalid SSH public key format'),
], async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const { organizationId, name, publicKey } = req.body;

    // Verify organization exists
    const orgCheck = await query('SELECT id, name FROM organizations WHERE id = $1', [organizationId]);
    if (orgCheck.rows.length === 0) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    // Validate SSH key format
    const validation = validateSSHKeyFormat(publicKey);
    if (!validation.valid) {
      res.status(400).json({
        error: validation.error,
        code: ErrorCodes.SSH_KEY_INVALID
      });
      return;
    }

    // Generate fingerprint
    let fingerprint: string;
    try {
      fingerprint = generateFingerprint(publicKey);
    } catch (error: any) {
      res.status(400).json({
        error: 'Invalid SSH public key format',
        code: ErrorCodes.SSH_KEY_INVALID
      });
      return;
    }

    // Check for duplicate fingerprint for this organization
    const duplicateCheck = await query(
      'SELECT id FROM user_ssh_keys WHERE organization_id = $1 AND fingerprint = $2',
      [organizationId, fingerprint]
    );

    if (duplicateCheck.rows.length > 0) {
      res.status(400).json({
        error: 'This SSH key already exists for this organization',
        code: ErrorCodes.SSH_KEY_DUPLICATE
      });
      return;
    }

    // Get provider API tokens
    const tokens = await getProviderTokens();

    // Synchronize to providers
    const providerResults: ProviderResult[] = [];
    let linodeKeyId: string | null = null;

    // Build normalized provider label
    const providerLabel = await buildProviderKeyLabel(organizationId, req.user.email, name);

    // Add to Linode with retry logic
    if (tokens.linode) {
      try {
        const linodeKey = await withRetry(
          () => linodeService.createSSHKey(tokens.linode!, providerLabel, publicKey),
          { maxRetries: 2 }
        );
        linodeKeyId = String(linodeKey.id);

        providerResults.push({
          provider: 'linode',
          success: true,
          providerId: linodeKeyId
        });
      } catch (error: any) {
        const structuredError = handleProviderError(error, 'linode', 'create SSH key');
        logError('Linode SSH key creation (admin)', error, { userId: req.user.id, name, organizationId });

        providerResults.push({
          provider: 'linode',
          success: false,
          error: structuredError.message
        });
      }
    }

    // Store in database
    const insertResult = await query(
      `INSERT INTO user_ssh_keys 
       (organization_id, name, public_key, fingerprint, linode_key_id, created_by_user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, organization_id, name, public_key, fingerprint, linode_key_id, created_at, updated_at`,
      [organizationId, name, publicKey, fingerprint, linodeKeyId, req.user.id]
    );

    const newKey = insertResult.rows[0];

    // Log activity
    await logActivity({
      userId: req.user.id,
      organizationId,
      entityType: 'ssh_key',
      entityId: newKey.id,
      eventType: 'ssh_key.create',
      message: `Admin added SSH key "${name}" to organization`,
      metadata: {
        ...buildActivityMetadata(fingerprint, providerResults),
        keyName: name,
        isAdminAction: true,
      },
    });

    // Determine response message
    const successCount = providerResults.filter(r => r.success).length;
    const partialSuccess = successCount > 0 && successCount < providerResults.length;

    res.status(201).json({
      key: {
        ...mapSSHKeyRow({
          ...newKey,
          organization_name: orgCheck.rows[0].name,
          creator_id: req.user.id,
          creator_name: req.user.name,
          creator_email: req.user.email,
        }),
      },
      message: partialSuccess
        ? 'SSH key added with partial provider synchronization'
        : getSSHKeySuccessMessage(name, providerResults).message,
      partialSuccess,
      providerResults,
    });
  } catch (error: any) {
    console.error('Error creating SSH key:', error);
    res.status(500).json({ error: error.message || 'Failed to create SSH key' });
  }
});

/**
 * DELETE /api/admin/ssh-keys/:keyId
 * Delete an SSH key (admin override - can delete any key)
 */
router.delete('/:keyId', [
  param('keyId').isUUID(),
], async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const { keyId } = req.params;

    // Get the SSH key
    const keyResult = await query(
      `SELECT 
        usk.id,
        usk.organization_id,
        o.name as organization_name,
        usk.name,
        usk.public_key,
        usk.fingerprint,
        usk.linode_key_id
       FROM user_ssh_keys usk
       LEFT JOIN organizations o ON o.id = usk.organization_id
       WHERE usk.id = $1`,
      [keyId]
    );

    if (keyResult.rows.length === 0) {
      res.status(404).json({ error: 'SSH key not found' });
      return;
    }

    const key = keyResult.rows[0];

    // Get provider API tokens
    const tokens = await getProviderTokens();

    // Delete from providers
    const providerResults: ProviderResult[] = [];

    // Delete from Linode
    if (tokens.linode && key.linode_key_id) {
      try {
        await withRetry(
          () => linodeService.deleteSSHKey(tokens.linode!, key.linode_key_id),
          { maxRetries: 2 }
        );

        providerResults.push({
          provider: 'linode',
          success: true,
        });
      } catch (error: any) {
        const structuredError = handleProviderError(error, 'linode', 'delete SSH key');
        logError('Linode SSH key deletion (admin)', error, { userId: req.user.id, keyId });

        providerResults.push({
          provider: 'linode',
          success: false,
          error: structuredError.message
        });
      }
    }

    // Delete from database
    await query('DELETE FROM user_ssh_keys WHERE id = $1', [keyId]);

    // Log activity
    await logActivity({
      userId: req.user.id,
      organizationId: key.organization_id,
      entityType: 'ssh_key',
      entityId: keyId,
      eventType: 'ssh_key.delete',
      message: `Admin deleted SSH key "${key.name}" from organization "${key.organization_name}"`,
      metadata: {
        ...buildActivityMetadata(key.fingerprint, providerResults),
        keyName: key.name,
        isAdminAction: true,
      },
    });

    // Determine response message
    const successCount = providerResults.filter(r => r.success).length;
    const partialSuccess = providerResults.length > 0 && successCount < providerResults.length;

    res.json({
      message: partialSuccess
        ? 'SSH key deleted with partial provider synchronization'
        : getSSHKeyDeleteMessage(key.name, providerResults).message,
      partialSuccess,
      providerResults,
    });
  } catch (error: any) {
    console.error('Error deleting SSH key:', error);
    res.status(500).json({ error: error.message || 'Failed to delete SSH key' });
  }
});

export default router;
