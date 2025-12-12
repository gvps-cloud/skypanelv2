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

// Get PHP Settings
router.get('/:id/php', verifyOwnership, async (req, res) => {
    try {
        const settings = await enhanceService.getPhpSettings(req.params.id);
        res.json(settings);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Update PHP Version
router.put('/:id/php', verifyOwnership, async (req, res) => {
    const { version } = req.body;
    try {
        await enhanceService.updatePhpVersion(req.params.id, version);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Restart PHP
router.post('/:id/restart-php', verifyOwnership, async (req, res) => {
    try {
        await enhanceService.restartPhp(req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
