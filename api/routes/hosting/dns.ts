import express from 'express';
import { enhanceService } from '../../services/enhanceService.js';
import { authenticateToken } from '../../middleware/auth.js';
import { requireHostingEnabledForUsers } from '../../middleware/hosting.js';
import { pool } from '../../lib/database.js';

const router = express.Router();
router.use(authenticateToken);
router.use(requireHostingEnabledForUsers);

async function verifyOwnership(req: any, res: any, next: any) {
    const { id } = req.params; // enhance_website_id
    const userId = req.user.id;
    const check = await pool.query('SELECT * FROM hosting_subscriptions WHERE enhance_website_id = $1 AND user_id = $2', [id, userId]);
    if (check.rows.length === 0) return res.status(403).json({ error: 'Unauthorized' });
    next();
}

// List Records
router.get('/:id/records', verifyOwnership, async (req, res) => {
    try {
        const list = await enhanceService.getZoneRecords(req.params.id);
        res.json(list);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Add Record
router.post('/:id/records', verifyOwnership, async (req, res) => {
    try {
        await enhanceService.addDnsRecord(req.params.id, req.body);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Delete Record
router.delete('/:id/records/:recordId', verifyOwnership, async (req, res) => {
    try {
        await enhanceService.deleteDnsRecord(req.params.id, req.params.recordId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
