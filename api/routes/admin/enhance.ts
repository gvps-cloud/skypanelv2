import express from 'express';
import { pool } from '../../lib/database.js';
import { enhanceService } from '../../services/enhanceService.js';
import { requireAdmin, authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

// Get current configuration
router.get('/config', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM enhance_config WHERE is_active = true LIMIT 1');
        if (result.rows.length === 0) return res.json(null);

        const config = result.rows[0];
        // Don't return the full key for security, just mask it or return existence
        config.api_key = config.api_key ? '***' : null;
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Update configuration
router.post('/config', async (req, res) => {
    const { api_url, org_id, api_key, name } = req.body;

    // Validate first
    const isValid = await enhanceService.validateCredentials(api_url, org_id, api_key);
    if (!isValid) {
        return res.status(400).json({ error: 'Invalid API Credentials. Could not connect to Enhance.' });
    }

    try {
        // Upsert singleton config
        await pool.query('DELETE FROM enhance_config'); // Reset old config
        await pool.query(`
      INSERT INTO enhance_config (name, api_url, org_id, api_key)
      VALUES ($1, $2, $3, $4)
    `, [name || 'Default Cluster', api_url, org_id, api_key]);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save configuration' });
    }
});

// Test Connection
router.post('/test-connection', async (req, res) => {
    let { api_url, org_id, api_key } = req.body;

    // If API key is not provided, try to use the stored one
    if (!api_key) {
        const result = await pool.query('SELECT api_key FROM enhance_config WHERE is_active = true LIMIT 1');
        if (result.rows.length > 0) {
            api_key = result.rows[0].api_key;
        }
    }

    if (!api_key) {
        return res.status(400).json({ error: 'API Key is required to test connection.' });
    }

    const isValid = await enhanceService.validateCredentials(api_url, org_id, api_key);
    if (!isValid) {
        return res.status(400).json({ error: 'Connection Failed. Check URL and Credentials.' });
    }

    res.json({ success: true, message: 'Connection Successful!' });
});

// Trigger Plan Sync
router.post('/sync-plans', async (req, res) => {
    try {
        await enhanceService.syncPlans();
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to sync plans' });
    }
});

// List synced plans
router.get('/plans', async (req, res) => {
    try {
        // Get plans with usage counts
        const result = await pool.query(`
      SELECT p.*, count(s.id) as subscriber_count 
      FROM hosting_plans p
      LEFT JOIN hosting_subscriptions s ON s.plan_id = p.id
      GROUP BY p.id
      ORDER BY p.name ASC
    `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Update Plan (Pricing/Type/Features/Description)
router.put('/plans/:id', async (req, res) => {
    const { id } = req.params;
    const { name, price_monthly, service_type, is_active, features, description } = req.body;

    try {
        await pool.query(`
      UPDATE hosting_plans 
      SET name = COALESCE($1, name),
          price_monthly = COALESCE($2, price_monthly),
          service_type = COALESCE($3, service_type),
          is_active = COALESCE($4, is_active),
          features = COALESCE($5, features),
          description = COALESCE($6, description)
      WHERE id = $7
    `, [name, price_monthly, service_type, is_active, features ? JSON.stringify(features) : null, description, id]);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update plan' });
    }
});

export default router;
