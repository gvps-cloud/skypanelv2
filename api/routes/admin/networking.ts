/**
 * Admin Networking Routes
 * IP address management, IPv6 ranges/pools, VLANs
 * All routes require admin authentication
 */

import { Router, type Request, type Response } from 'express';
import { body, param, query as queryValidator, validationResult } from 'express-validator';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { query } from '../../lib/database.js';
import * as ipService from '../../services/ipService.js';

const router = Router();
router.use(authenticateToken, requireAdmin);

// ── IP Addresses ──

// List all IPs
router.get('/ips',
  queryValidator('page').optional().isInt({ min: 1 }),
  queryValidator('pageSize').optional().isInt({ min: 1, max: 500 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.pageSize) || 100;

      // Only show IPs belonging to VPS instances created in this panel
      const knownInstances = await query('SELECT DISTINCT provider_instance_id FROM vps_instances');
      const knownIds = new Set(knownInstances.rows.map((r: any) => String(r.provider_instance_id)));

      // Fetch pages from Linode to find panel-created IPs (cap at 10 pages to avoid slowness)
      const allFiltered: any[] = [];
      let linodePage = 1;
      let totalPages = 1;
      const maxPages = 10;
      do {
        const result = await ipService.listAllIPs(linodePage, 100);
        totalPages = result.pages;
        for (const ip of result.data) {
          if (ip.instanceId && knownIds.has(ip.instanceId)) {
            allFiltered.push(ip);
          }
        }
        linodePage++;
      } while (linodePage <= totalPages && linodePage <= maxPages);

      // Paginate the filtered results
      const total = allFiltered.length;
      const start = (page - 1) * pageSize;
      const paged = allFiltered.slice(start, start + pageSize);
      res.json({ success: true, data: paged, pages: Math.ceil(total / pageSize) || 1, total });
    } catch (error: any) {
      console.error('Error listing IPs:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to list IPs' });
    }
  }
);

// Get single IP
router.get('/ips/:address',
  param('address').isString().trim().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const ip = await ipService.getIPAddress(req.params.address);
      res.json({ success: true, data: ip });
    } catch (error: any) {
      console.error('Error getting IP:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to get IP' });
    }
  }
);

// Allocate IP
router.post('/ips',
  body('instanceId').isString().trim().notEmpty(),
  body('public').isBoolean(),
  body('type').isIn(['ipv4', 'ipv6']),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const ip = await ipService.allocateIP({
        instanceId: req.body.instanceId,
        public: req.body.public,
        type: req.body.type,
      });
      res.json({ success: true, data: ip });
    } catch (error: any) {
      console.error('Error allocating IP:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to allocate IP' });
    }
  }
);

// Delete IP
router.delete('/ips/:instanceId/:address',
  param('instanceId').isString().trim().notEmpty(),
  param('address').isString().trim().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      await ipService.deleteIPAddress(req.params.instanceId, req.params.address);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting IP:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to delete IP' });
    }
  }
);

// Assign IPs between instances
router.post('/ips/assign',
  body('assignments').isArray({ min: 1 }),
  body('assignments.*.address').isString().trim().notEmpty(),
  body('assignments.*.instanceId').isString().trim().notEmpty(),
  body('region').isString().trim().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      await ipService.assignIPs(req.body);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error assigning IPs:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to assign IPs' });
    }
  }
);

// Share IPs for failover
router.post('/ips/share',
  body('instanceId').isString().trim().notEmpty(),
  body('ips').isArray(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      await ipService.shareIPs(req.body);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error sharing IPs:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to share IPs' });
    }
  }
);

// Update IP reverse DNS
router.put('/ips/:address/rdns',
  param('address').isString().trim().notEmpty(),
  body('rdns').optional({ nullable: true }).isString(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const ip = await ipService.updateIPReverseDNS(req.params.address, req.body.rdns ?? null);
      res.json({ success: true, data: ip });
    } catch (error: any) {
      console.error('Error updating rDNS:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to update rDNS' });
    }
  }
);

// ── IPv6 ──

// List IPv6 pools
router.get('/ipv6/pools', async (_req: Request, res: Response) => {
  try {
    const pools = await ipService.listIPv6Pools();
    res.json({ success: true, data: pools });
  } catch (error: any) {
    console.error('Error listing IPv6 pools:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to list IPv6 pools' });
  }
});

// List IPv6 ranges
router.get('/ipv6/ranges', async (_req: Request, res: Response) => {
  try {
    const ranges = await ipService.listIPv6Ranges();
    // Filter to only ranges routed to panel-created VPS instances
    const knownInstances = await query('SELECT DISTINCT provider_instance_id FROM vps_instances');
    const knownIds = new Set(knownInstances.rows.map((r: any) => String(r.provider_instance_id)));
    const filtered = ranges.filter((range) =>
      range.instanceIds && range.instanceIds.some((id) => knownIds.has(id))
    );
    res.json({ success: true, data: filtered });
  } catch (error: any) {
    console.error('Error listing IPv6 ranges:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to list IPv6 ranges' });
  }
});

// Create IPv6 range
router.post('/ipv6/ranges',
  body('prefixLength').isInt({ min: 56, max: 64 }),
  body('instanceId').optional().isString().trim(),
  body('routeTarget').optional().isString().trim(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const result = await ipService.createIPv6Range({
        instanceId: req.body.instanceId,
        routeTarget: req.body.routeTarget,
        prefixLength: req.body.prefixLength,
      });
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('Error creating IPv6 range:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to create IPv6 range' });
    }
  }
);

// Delete IPv6 range
router.delete('/ipv6/ranges/:range',
  param('range').isString().trim().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      await ipService.deleteIPv6Range(req.params.range);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting IPv6 range:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to delete IPv6 range' });
    }
  }
);

// ── VLANs ──

// List VLANs
router.get('/vlans', async (_req: Request, res: Response) => {
  try {
    const vlans = await ipService.listVLANs();
    res.json({ success: true, data: vlans });
  } catch (error: any) {
    console.error('Error listing VLANs:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to list VLANs' });
  }
});

// Delete VLAN
router.delete('/vlans/:regionId/:label',
  param('regionId').isString().trim().notEmpty(),
  param('label').isString().trim().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      await ipService.deleteVLAN(req.params.regionId, req.params.label);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting VLAN:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to delete VLAN' });
    }
  }
);

// ── Firewalls ──

// List firewalls
router.get('/firewalls', async (_req: Request, res: Response) => {
  try {
    const result = await ipService.listFirewalls();
    res.json({ success: true, data: result.data, pages: result.pages, total: result.total });
  } catch (error: any) {
    console.error('Error listing firewalls:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to list firewalls' });
  }
});

// Create firewall
router.post('/firewalls',
  body('label').isString().trim().notEmpty(),
  body('rules').isObject(),
  body('rules.inbound_policy').isIn(['ACCEPT', 'DROP']),
  body('rules.outbound_policy').isIn(['ACCEPT', 'DROP']),
  body('rules.inbound').optional().isArray(),
  body('rules.outbound').optional().isArray(),
  body('tags').optional().isArray(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const fw = await ipService.createFirewall({
        label: req.body.label,
        rules: req.body.rules,
        tags: req.body.tags,
      });
      res.json({ success: true, data: fw });
    } catch (error: any) {
      console.error('Error creating firewall:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to create firewall' });
    }
  }
);

// Get single firewall
router.get('/firewalls/:id',
  param('id').isInt({ min: 1 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const fw = await ipService.getFirewall(Number(req.params.id));
      res.json({ success: true, data: fw });
    } catch (error: any) {
      console.error('Error getting firewall:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to get firewall' });
    }
  }
);

// Update firewall
router.put('/firewalls/:id',
  param('id').isInt({ min: 1 }),
  body('label').optional().isString().trim().notEmpty(),
  body('status').optional().isIn(['enabled', 'disabled']),
  body('tags').optional().isArray(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const updates: Record<string, unknown> = {};
      if (req.body.label !== undefined) updates.label = req.body.label;
      if (req.body.status !== undefined) updates.status = req.body.status;
      if (req.body.tags !== undefined) updates.tags = req.body.tags;

      const fw = await ipService.updateFirewall(Number(req.params.id), updates as any);
      res.json({ success: true, data: fw });
    } catch (error: any) {
      console.error('Error updating firewall:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to update firewall' });
    }
  }
);

// Delete firewall
router.delete('/firewalls/:id',
  param('id').isInt({ min: 1 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      await ipService.deleteFirewall(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting firewall:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to delete firewall' });
    }
  }
);

// Get firewall rules
router.get('/firewalls/:id/rules',
  param('id').isInt({ min: 1 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const rules = await ipService.getFirewallRules(Number(req.params.id));
      res.json({ success: true, data: rules });
    } catch (error: any) {
      console.error('Error getting firewall rules:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to get firewall rules' });
    }
  }
);

// Update firewall rules
router.put('/firewalls/:id/rules',
  param('id').isInt({ min: 1 }),
  body('inbound_policy').isIn(['ACCEPT', 'DROP']),
  body('outbound_policy').isIn(['ACCEPT', 'DROP']),
  body('inbound').optional().isArray(),
  body('outbound').optional().isArray(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const rules = await ipService.updateFirewallRules(Number(req.params.id), {
        inbound_policy: req.body.inbound_policy,
        outbound_policy: req.body.outbound_policy,
        inbound: req.body.inbound ?? [],
        outbound: req.body.outbound ?? [],
      });
      res.json({ success: true, data: rules });
    } catch (error: any) {
      console.error('Error updating firewall rules:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to update firewall rules' });
    }
  }
);

// List firewall devices
router.get('/firewalls/:id/devices',
  param('id').isInt({ min: 1 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const devices = await ipService.getFirewallDevices(Number(req.params.id));
      res.json({ success: true, data: devices });
    } catch (error: any) {
      console.error('Error listing firewall devices:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to list firewall devices' });
    }
  }
);

// Attach firewall device
router.post('/firewalls/:id/devices',
  param('id').isInt({ min: 1 }),
  body('type').isIn(['linode', 'linode_interface', 'nodebalancer']),
  body('entityId').isInt({ min: 1 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const device = await ipService.attachFirewallDevice(
        Number(req.params.id),
        req.body.type,
        Number(req.body.entityId),
      );
      res.json({ success: true, data: device });
    } catch (error: any) {
      console.error('Error attaching firewall device:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to attach firewall device' });
    }
  }
);

// Detach firewall device
router.delete('/firewalls/:id/devices/:deviceId',
  param('id').isInt({ min: 1 }),
  param('deviceId').isInt({ min: 1 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      await ipService.detachFirewallDevice(Number(req.params.id), Number(req.params.deviceId));
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error detaching firewall device:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to detach firewall device' });
    }
  }
);

// Get firewall history
router.get('/firewalls/:id/history',
  param('id').isInt({ min: 1 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      // History not available through provider abstraction yet — use linodeService directly
      const { linodeService } = await import('../../services/linodeService.js');
      const history = await linodeService.getFirewallHistory(Number(req.params.id));
      res.json({ success: true, data: history });
    } catch (error: any) {
      console.error('Error getting firewall history:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to get firewall history' });
    }
  }
);

// ── Firewall Settings ──

// Get firewall settings
router.get('/firewall-settings', async (_req: Request, res: Response) => {
  try {
    const settings = await ipService.getFirewallSettings();
    res.json({ success: true, data: settings });
  } catch (error: any) {
    console.error('Error getting firewall settings:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to get firewall settings' });
  }
});

// Update firewall settings
router.put('/firewall-settings',
  body('default_firewall_ids').optional().isObject(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const settings = await ipService.updateFirewallSettings(req.body);
      res.json({ success: true, data: settings });
    } catch (error: any) {
      console.error('Error updating firewall settings:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to update firewall settings' });
    }
  }
);

// ── Firewall Templates ──

// List firewall templates
router.get('/firewall-templates', async (_req: Request, res: Response) => {
  try {
    const templates = await ipService.listFirewallTemplates();
    res.json({ success: true, data: templates });
  } catch (error: any) {
    console.error('Error listing firewall templates:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to list firewall templates' });
  }
});

// Get firewall template
router.get('/firewall-templates/:slug',
  param('slug').isString().trim().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const template = await ipService.getFirewallTemplate(req.params.slug);
      res.json({ success: true, data: template });
    } catch (error: any) {
      console.error('Error getting firewall template:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to get firewall template' });
    }
  }
);

export default router;
