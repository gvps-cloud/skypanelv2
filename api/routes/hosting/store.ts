import express from 'express';
import { pool } from '../../lib/database.js';
import { enhanceService } from '../../services/enhanceService.js';
import { authenticateToken } from '../../middleware/auth.js';
import { requireHostingEnabledForUsers } from '../../middleware/hosting.js';

const router = express.Router();

// Public endpoint to check if web hosting is enabled
router.get('/status', async (req, res) => {
    try {
        const enhanceConfig = await pool.query('SELECT enabled FROM enhance_config WHERE is_active = true LIMIT 1');
        const isEnabled = enhanceConfig.rows.length > 0 ? enhanceConfig.rows[0].enabled : true;
        res.json({ enabled: isEnabled });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.use(authenticateToken);
// Apply hosting enabled check to all subsequent routes (except for admins)
router.use(requireHostingEnabledForUsers);

// List Available Plans
router.get('/plans', async (req, res) => {
    try {
        // Check if web hosting is enabled
        const enhanceConfig = await pool.query('SELECT enabled FROM enhance_config WHERE is_active = true LIMIT 1');
        const isWebHostingEnabled = enhanceConfig.rows.length > 0 ? enhanceConfig.rows[0].enabled : true;

        // If web hosting is disabled and no specific type is requested, return empty array
        const { type } = req.query;
        if (!type && !isWebHostingEnabled) {
            return res.json([]);
        }

        let query = 'SELECT * FROM hosting_plans WHERE is_active = true';
        const params: any[] = [];

        if (type) {
            query += ' AND service_type = $1';
            params.push(type);
        }

        query += ' ORDER BY price_monthly ASC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// List Available Regions (Server Groups)
router.get('/regions', async (req, res) => {
    try {
        const regions = await enhanceService.getServerGroups();
        res.json(regions);
    } catch (error) {
        console.error('Failed to load regions:', error);
        // Fail gracefully - user just won't see regions
        res.json([]);
    }
});

// List User Services
router.get('/services', async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const result = await pool.query(`
      SELECT s.*, p.name as plan_name, p.service_type 
      FROM hosting_subscriptions s
      JOIN hosting_plans p ON s.plan_id = p.id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
    `, [userId]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Get Single Service
router.get('/services/:id', async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const { id } = req.params;

        // Join with Plans to get type/name
        const result = await pool.query(`
        SELECT s.*, p.name as plan_name, p.service_type 
        FROM hosting_subscriptions s
        JOIN hosting_plans p ON s.plan_id = p.id
        WHERE s.id = $1 AND s.user_id = $2
    `, [id, userId]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Service not found' });

        const service = result.rows[0];
        res.json({
            id: service.id,
            domain: service.domain,
            status: service.status,
            plan: {
                name: service.plan_name,
                service_type: service.service_type
            },
            enhance_website_id: service.enhance_website_id
        });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Purchase Subscription
router.post('/purchase', async (req, res) => {
    const { planId, domain, region } = req.body; // region is optional serverGroupId
    const userId = (req as any).user.id;

    if (!planId || !domain) {
        return res.status(400).json({ error: 'Missing plan or domain' });
    }

    try {
        // 1. Check Wallet Balance
        const planRes = await pool.query('SELECT * FROM hosting_plans WHERE id = $1', [planId]);
        if (planRes.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });
        const plan = planRes.rows[0];

        const walletRes = await pool.query(`
      SELECT * FROM wallets 
      WHERE organization_id = (SELECT organization_id FROM organization_members WHERE user_id = $1 AND role = 'owner' LIMIT 1)
    `, [userId]);

        const wallet = walletRes.rows[0];
        if (Number(wallet.balance) < Number(plan.price_monthly)) {
            return res.status(402).json({ error: 'Insufficient funds' });
        }

        // 2. Provision Service (Enhance API call)
        // This creates the website in Enhance and the record in hosting_subscriptions
        // Note: Provisioning errors throw, so we catch them below before charging
        const websiteId = await enhanceService.provisionSubscription(userId, planId, domain, region);

        // 3. Charge Wallet (Simple transaction)
        await pool.query('BEGIN');

        await pool.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2', [plan.price_monthly, wallet.id]);

        await pool.query(`
      INSERT INTO payment_transactions 
      (organization_id, amount, description, status, payment_method, payment_provider, metadata)
      VALUES ($1, $2, $3, 'completed', 'wallet', 'system', $4)
    `, [
            wallet.organization_id,
            plan.price_monthly,
            `Hosting Subscription: ${plan.name} (${domain})`,
            JSON.stringify({ planId, domain, subscriptionId: websiteId })
        ]);

        await pool.query('COMMIT');

        res.json({ success: true, subscriptionId: websiteId });

    } catch (error: any) {
        await pool.query('ROLLBACK');
        console.error('Purchase Error:', error);
        res.status(500).json({ error: error.message || 'Purchase failed' });
    }
});

export default router;
