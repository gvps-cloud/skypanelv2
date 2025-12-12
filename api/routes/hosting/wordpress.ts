import express from 'express';
import { enhanceService } from '../../services/enhanceService.js';
import { authenticateToken } from '../../middleware/auth.js';
import { pool } from '../../lib/database.js';

const router = express.Router();
router.use(authenticateToken);

async function verifyOwnership(req: any, res: any, next: any) {
    const { id } = req.params;
    const userId = req.user.id;
    const check = await pool.query('SELECT * FROM hosting_subscriptions WHERE enhance_website_id = $1 AND user_id = $2', [id, userId]);
    if (check.rows.length === 0) return res.status(403).json({ error: 'Unauthorized' });
    next();
}

// Install Wordpress
router.post('/:id/install', verifyOwnership, async (req, res) => {
    const { title, adminUser } = req.body;
    try {
        await enhanceService.installWordpress(req.params.id, title, adminUser);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get SSO Link
router.get('/:id/sso', verifyOwnership, async (req, res) => {
    try {
        const url = await enhanceService.getWordpressSso(req.params.id);
        res.json({ url });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
