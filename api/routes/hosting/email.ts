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

// List Accounts
router.get('/:id/accounts', verifyOwnership, async (req, res) => {
    try {
        const list = await enhanceService.listEmailAccounts(req.params.id);
        res.json(list);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Create Account
router.post('/:id/accounts', verifyOwnership, async (req, res) => {
    const { email, password, quota } = req.body;
    try {
        await enhanceService.createEmailAccount(req.params.id, email, password, quota);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Delete Account
router.delete('/:id/accounts/:email', verifyOwnership, async (req, res) => {
    try {
        await enhanceService.deleteEmailAccount(req.params.id, req.params.email);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
