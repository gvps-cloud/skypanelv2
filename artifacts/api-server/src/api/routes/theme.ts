import express from 'express';
import { themeService } from '../services/themeService.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const theme = await themeService.getThemeConfig();
    res.json({ theme });
  } catch (err: unknown) {
    console.error('Theme config fetch error:', err);
    res.status(500).json({ error: 'Failed to load theme configuration' });
  }
});

export default router;
