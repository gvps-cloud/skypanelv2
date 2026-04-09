/**
 * Admin Networking Routes
 * IP address management, IPv6 ranges/pools, VLANs
 * All routes require admin authentication
 */

import { Router, type Request, type Response } from 'express';
import { body, param, query as queryValidator, validationResult } from 'express-validator';
import { isIP } from 'net';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { query } from '../../lib/database.js';
import * as ipService from '../../services/ipService.js';
import { linodeService } from '../../services/linodeService.js';
import { logActivity } from '../../services/activityLogger.js';
import {
  getPanelIpv6PrefixRangesForRdns,
  ipv6AddressInRange,
  ipv6AddressOwnedByLinodeInstance,
} from '../../lib/ipv6.js';

// Custom validator for IP addresses (IPv4 and IPv6)
function isValidIP(value: string): boolean {
  return isIP(value) !== 0;
}

// Valid firewall rule actions and protocols
const FIREWALL_ACTIONS = ['ACCEPT', 'DROP'];
const FIREWALL_PROTOCOLS = ['tcp', 'udp', 'icmp', 'all', 'ipv6', 'icmpv6'];

// Validate a single firewall rule object
function isValidFirewallRule(rule: any): boolean {
  if (!rule || typeof rule !== 'object') return false;
  if (!FIREWALL_ACTIONS.includes(rule.action)) return false;
  if (rule.protocol && !FIREWALL_PROTOCOLS.includes(rule.protocol)) return false;
  // ports should be a string if present
  if (rule.ports !== undefined && typeof rule.ports !== 'string') return false;
  return true;
}

// Custom validator for firewall rules array
function isValidFirewallRulesArray(value: any): boolean {
  if (!Array.isArray(value)) return false;
  return value.every((rule) => isValidFirewallRule(rule));
}

// Custom validator for firewall tags array
function isValidTagsArray(value: any): boolean {
  if (!Array.isArray(value)) return false;
  return value.every((tag) => typeof tag === 'string' && tag.length <= 50);
}

const router = Router();
router.use(authenticateToken, requireAdmin);

function hasConcreteRdns(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

type AdminIPv6PrefixContext = {
  range: string;
  prefixLength: number;
  region: string;
  routeTarget: string | null;
};

function mapAdminIPv6PrefixContext(entry: any): AdminIPv6PrefixContext | null {
  if (!entry || typeof entry !== 'object') return null;

  const range = typeof entry.range === 'string' ? entry.range.trim() : '';
  if (!range) return null;

  const parsedPrefix =
    typeof entry.prefix === 'number'
      ? entry.prefix
      : typeof entry.prefix === 'string'
        ? Number(entry.prefix)
        : NaN;
  const prefixLength = Number.isFinite(parsedPrefix) ? Number(parsedPrefix) : 64;

  return {
    range,
    prefixLength,
    region: typeof entry.region === 'string' ? entry.region : '',
    routeTarget:
      typeof entry.route_target === 'string' && entry.route_target.trim().length > 0
        ? entry.route_target
        : null,
  };
}

function getAdminIPv6PrefixContext(
  ipPayload: { ipv6?: Record<string, unknown> } | null | undefined,
): AdminIPv6PrefixContext[] {
  const ipv6 = ipPayload?.ipv6 as Record<string, unknown> | undefined;
  const collected: AdminIPv6PrefixContext[] = [];
  const dedupe = new Set<string>();

  const push = (prefix: AdminIPv6PrefixContext | null) => {
    if (!prefix) return;
    const key = `${prefix.range}|${prefix.prefixLength}`;
    if (dedupe.has(key)) return;
    dedupe.add(key);
    collected.push(prefix);
  };

  for (const key of ['global', 'ranges'] as const) {
    const value = ipv6?.[key];
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      push(mapAdminIPv6PrefixContext(entry));
    }
  }

  if (collected.length > 0) {
    return collected;
  }

  // Fallback for payload shapes that only expose range/prefix pairs.
  for (const prefix of getPanelIpv6PrefixRangesForRdns(ipPayload)) {
    push({
      range: prefix.range,
      prefixLength: prefix.prefix,
      region: '',
      routeTarget: null,
    });
  }

  return collected;
}

async function enrichVisibleIPv6Rdns(ips: any[]): Promise<any[]> {
  return Promise.all(
    ips.map(async (ip) => {
      if (!ip || ip.type !== 'ipv6' || hasConcreteRdns(ip.rdns) || !ip.address) {
        return ip;
      }

      try {
        const detailed = await ipService.getIPAddress(ip.address);
        return hasConcreteRdns(detailed?.rdns)
          ? { ...ip, rdns: detailed.rdns }
          : ip;
      } catch (error) {
        console.warn(`Failed to enrich IPv6 rDNS for ${ip.address}:`, error);
        return ip;
      }
    })
  );
}

function mapAdminIPv6Range(collectionRange: any, detailRange?: any) {
  const instanceIds = Array.isArray(detailRange?.linodes)
    ? detailRange.linodes.map(String)
    : Array.isArray(collectionRange?.linodes)
      ? collectionRange.linodes.map(String)
      : [];

  return {
    range: collectionRange?.range ?? detailRange?.range ?? '',
    instanceId: instanceIds[0] ?? null,
    instanceIds,
    routeTarget: collectionRange?.route_target ?? detailRange?.route_target ?? null,
    region: collectionRange?.region ?? detailRange?.region ?? '',
    prefixLength: collectionRange?.prefix ?? detailRange?.prefix ?? 64,
    created: collectionRange?.created ?? detailRange?.created ?? '',
  };
}

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
      const knownInstances = await query(
        `SELECT id::text AS id, label, provider_instance_id::text AS provider_instance_id
         FROM vps_instances
         WHERE provider_instance_id IS NOT NULL`,
      );
      const knownIds = new Set(knownInstances.rows.map((r: any) => String(r.provider_instance_id)));
      const panelVpsByProviderId = new Map<
        string,
        { id: string; label: string }
      >();
      for (const row of knownInstances.rows) {
        const providerId = String(row.provider_instance_id);
        if (!panelVpsByProviderId.has(providerId)) {
          panelVpsByProviderId.set(providerId, {
            id: String(row.id),
            label: String(row.label ?? ''),
          });
        }
      }

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
      const rdnsEnriched = await enrichVisibleIPv6Rdns(paged);

      const instanceIpCache = new Map<string, Promise<{ ipv6?: Record<string, unknown> } | null>>();
      const getInstanceIpPayload = (instanceId: string) => {
        if (!instanceIpCache.has(instanceId)) {
          const providerId = Number(instanceId);
          if (!Number.isFinite(providerId)) {
            instanceIpCache.set(instanceId, Promise.resolve(null));
          } else {
            instanceIpCache.set(
              instanceId,
              Promise.resolve(linodeService.getLinodeInstanceIPs(providerId))
                .catch((error) => {
                  console.warn(`Failed to fetch IP payload for instance ${instanceId}:`, error);
                  return null;
                }),
            );
          }
        }
        return instanceIpCache.get(instanceId)!;
      };

      const enriched = await Promise.all(
        rdnsEnriched.map(async (ip) => {
          const instanceId = ip?.instanceId ? String(ip.instanceId) : null;
          const panelVps = instanceId ? panelVpsByProviderId.get(instanceId) : undefined;

          let payloadWithPanelInfo = ip;
          if (panelVps) {
            payloadWithPanelInfo = {
              ...payloadWithPanelInfo,
              vpsId: panelVps.id,
              vpsLabel: panelVps.label,
            };
          }

          if (ip?.type !== 'ipv6' || !instanceId) {
            return payloadWithPanelInfo;
          }

          const ipPayload = await getInstanceIpPayload(instanceId);
          if (!ipPayload) {
            return payloadWithPanelInfo;
          }

          const ipv6Prefixes = getAdminIPv6PrefixContext(ipPayload);
          if (ipv6Prefixes.length === 0) {
            return payloadWithPanelInfo;
          }

          return {
            ...payloadWithPanelInfo,
            ipv6Prefixes,
          };
        }),
      );

      res.json({ success: true, data: enriched, pages: Math.ceil(total / pageSize) || 1, total });
    } catch (error: any) {
      console.error('Error listing IPs:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to list IPs' });
    }
  }
);

// Get single IP
router.get('/ips/:address',
  param('address').isString().trim().notEmpty().custom(isValidIP),
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
  param('address').isString().trim().notEmpty().custom(isValidIP),
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
  body('assignments.*.address').isString().trim().notEmpty().custom(isValidIP),
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
  param('address').isString().trim().notEmpty().custom(isValidIP),
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
    const ranges = await linodeService.listIPv6Ranges();
    const knownInstances = await query('SELECT DISTINCT provider_instance_id FROM vps_instances');
    const knownIds = new Set(knownInstances.rows.map((r: any) => String(r.provider_instance_id)));

    const enriched = await Promise.all(
      ranges.map(async (range) => {
        try {
          const detail = await linodeService.getIPv6Range(range.range);
          return mapAdminIPv6Range(range, detail);
        } catch (error) {
          console.warn(`Failed to enrich IPv6 range ${range.range}:`, error);
          return mapAdminIPv6Range(range);
        }
      })
    );

    const filtered = enriched
      .map((range) => {
        const matchingInstanceIds = range.instanceIds.filter((id: string) => knownIds.has(id));
        return {
          ...range,
          instanceIds: matchingInstanceIds,
          instanceId: matchingInstanceIds[0] ?? null,
        };
      })
      .filter((range) => range.instanceIds.length > 0);

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

/** Panel VPS rows attached to a Linode IPv6 range (for admin sub-address rDNS UI). */
async function getPanelVpsForIPv6Range(range: string): Promise<
  Array<{ id: string; label: string; provider_instance_id: string }>
> {
  const knownInstances = await query('SELECT DISTINCT provider_instance_id FROM vps_instances');
  const knownIds = new Set(knownInstances.rows.map((r: any) => String(r.provider_instance_id)));

  let detail: { linodes?: number[] };
  try {
    detail = await linodeService.getIPv6Range(range);
  } catch {
    return [];
  }

  const instanceIds = Array.isArray(detail?.linodes)
    ? detail.linodes.map((id) => String(id)).filter((id) => knownIds.has(id))
    : [];

  if (instanceIds.length === 0) {
    return [];
  }

  const rowRes = await query(
    `SELECT id, label, provider_instance_id::text AS provider_instance_id
     FROM vps_instances
     WHERE provider_instance_id = ANY($1::text[])`,
    [instanceIds],
  );

  return rowRes.rows.map((r: any) => ({
    id: String(r.id),
    label: String(r.label ?? ''),
    provider_instance_id: String(r.provider_instance_id),
  }));
}

// List custom IPv6 rDNS records within a range (same filtering as customer VPS IPv6 rDNS dialog)
router.get(
  '/ipv6/range-rdns-records',
  queryValidator('range').isString().trim().notEmpty(),
  queryValidator('prefix').isInt({ min: 0, max: 128 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const range = String(req.query.range).trim();
      const prefix = Number(req.query.prefix);

      if (isIP(range) !== 6 && !range.includes(':')) {
        res.status(400).json({ success: false, error: 'Invalid IPv6 range' });
        return;
      }

      const vpsInstances = await getPanelVpsForIPv6Range(range);
      if (vpsInstances.length === 0) {
        res.json({ success: true, data: { records: [], vpsInstances: [] } });
        return;
      }

      const records: Array<{ address: string; rdns: string }> = [];
      try {
        const accountIPs = await linodeService.getAccountNetworkingIPs();
        const ipList = accountIPs?.data ?? [];
        for (const ip of ipList) {
          if (!ip.address || !ip.rdns) continue;
          if (!ip.address.includes(':')) continue;
          if (ip.rdns.includes('.ip.linodeusercontent.com')) continue;
          if (ipv6AddressInRange(ip.address, range, prefix)) {
            records.push({ address: ip.address, rdns: ip.rdns });
          }
        }
      } catch (fetchErr) {
        console.warn('Failed to fetch account IPs for admin IPv6 range rDNS:', fetchErr);
      }

      res.json({ success: true, data: { records, vpsInstances } });
    } catch (error: any) {
      console.error('Error listing IPv6 range rDNS records:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to list IPv6 rDNS records' });
    }
  },
);

// Set or clear reverse DNS for an IPv6 address within a panel-managed range
router.post(
  '/ipv6/range-rdns',
  body('range').isString().trim().notEmpty(),
  body('prefix').isInt({ min: 0, max: 128 }),
  body('address').isString().trim().notEmpty().custom(isValidIP),
  body('rdns').optional({ nullable: true }).isString(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const range = req.body.range as string;
      const prefix = Number(req.body.prefix);
      const normalizedAddress = (req.body.address as string).trim();
      const rdnsValue =
        typeof req.body.rdns === 'string' && req.body.rdns.trim().length > 0
          ? req.body.rdns.trim()
          : null;

      if (!normalizedAddress.includes(':')) {
        res.status(400).json({ success: false, error: 'An IPv6 address is required' });
        return;
      }

      if (!ipv6AddressInRange(normalizedAddress, range, prefix)) {
        res.status(400).json({ success: false, error: 'IPv6 address is not within the specified range' });
        return;
      }

      const vpsRows = await getPanelVpsForIPv6Range(range);
      if (vpsRows.length === 0) {
        res.status(404).json({ success: false, error: 'No panel VPS is attached to this IPv6 range' });
        return;
      }

      let owningVps: { id: string; label: string; provider_instance_id: string } | null = null;
      for (const row of vpsRows) {
        const pid = Number(row.provider_instance_id);
        if (!Number.isFinite(pid)) continue;
        try {
          const ipPayload = await linodeService.getLinodeInstanceIPs(pid);
          if (ipv6AddressOwnedByLinodeInstance(normalizedAddress, ipPayload)) {
            const prefixes = getPanelIpv6PrefixRangesForRdns(ipPayload);
            const rangeMatches = prefixes.some((p) => p.range === range && p.prefix === prefix);
            if (rangeMatches) {
              owningVps = row;
              break;
            }
          }
        } catch (e) {
          console.warn(`Failed to verify IPv6 ownership for instance ${pid}:`, e);
        }
      }

      if (!owningVps) {
        res.status(400).json({
          success: false,
          error: 'IPv6 address is not assigned to a panel VPS on this range',
        });
        return;
      }

      await linodeService.updateIPAddressReverseDNS(normalizedAddress, rdnsValue);

      const user = (req as any).user;
      try {
        await logActivity(
          {
            userId: user.id,
            organizationId: user.organizationId ?? null,
            eventType: 'admin.network.ipv6_rdns',
            entityType: 'vps',
            entityId: owningVps.id,
            message: `Admin updated rDNS for ${normalizedAddress} on VPS '${owningVps.label}'`,
            status: 'success',
            metadata: { ip: normalizedAddress, rdns: rdnsValue, ipv6Range: range, prefix },
          },
          req as any,
        );
      } catch (logErr) {
        console.warn('Failed to log admin IPv6 rDNS activity:', logErr);
      }

      res.json({ success: true, rdns: rdnsValue });
    } catch (error: any) {
      console.error('Error updating admin IPv6 range rDNS:', error);
      const message = error.message || 'Failed to update rDNS';
      const isValidationError = /forward dns|not found|invalid|must be/i.test(message);
      res.status(isValidationError ? 400 : 500).json({ success: false, error: message });
    }
  },
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
  body('label').isString().trim().notEmpty().isLength({ max: 100 }),
  body('rules').isObject(),
  body('rules.inbound_policy').isIn(['ACCEPT', 'DROP']),
  body('rules.outbound_policy').isIn(['ACCEPT', 'DROP']),
  body('rules.inbound').optional().isArray().custom(isValidFirewallRulesArray),
  body('rules.outbound').optional().isArray().custom(isValidFirewallRulesArray),
  body('tags').optional().isArray().custom(isValidTagsArray),
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
  body('inbound').optional().isArray().custom(isValidFirewallRulesArray),
  body('outbound').optional().isArray().custom(isValidFirewallRulesArray),
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
  authenticateToken,
  requireAdmin,
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
router.get('/firewall-settings',
  authenticateToken,
  requireAdmin,
  async (_req: Request, res: Response) => {
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
  authenticateToken,
  requireAdmin,
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
router.get('/firewall-templates',
  authenticateToken,
  requireAdmin,
  async (_req: Request, res: Response) => {
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
