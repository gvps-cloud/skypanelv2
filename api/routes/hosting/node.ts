import express from 'express';
import { enhanceService } from '../../services/enhanceService.js';
import { authenticateToken } from '../../middleware/auth.js';
import { pool } from '../../lib/database.js';

const router = express.Router();
router.use(authenticateToken);

// Helper to verify ownership
async function verifyOwnership(req: any, res: any, next: any) {
    const { id } = req.params; // enhance_website_id
    const userId = req.user.id;

    const check = await pool.query('SELECT * FROM hosting_subscriptions WHERE enhance_website_id = $1 AND user_id = $2', [id, userId]);
    if (check.rows.length === 0) return res.status(403).json({ error: 'Unauthorized' });

    next();
}

// Get App Info (Stub for now, or fetch from service)
router.get('/:id/app', verifyOwnership, async (req, res) => {
    try {
        const info = await enhanceService.getNodeApp(req.params.id);
        res.json(info);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Create App
router.post('/:id/app', verifyOwnership, async (req, res) => {
    const { version, entryPoint } = req.body;
    try {
        await enhanceService.createNodeApp(req.params.id, version, entryPoint);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Restart App
router.post('/:id/restart', verifyOwnership, async (req, res) => {
    try {
        await enhanceService.restartNodeApp(req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// NPM Install
router.post('/:id/npm-install', verifyOwnership, async (req, res) => {
    try {
        await enhanceService.runNpmInstall(req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
