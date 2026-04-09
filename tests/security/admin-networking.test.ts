import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mockQuery = vi.fn();
const mockListAllIPs = vi.fn();
const mockGetIPAddress = vi.fn();
const mockListIPv6Ranges = vi.fn();
const mockGetIPv6Range = vi.fn();
const mockGetLinodeInstanceIPs = vi.fn();
const mockGetAccountNetworkingIPs = vi.fn();
const mockUpdateIPAddressReverseDNS = vi.fn();

vi.mock("../../api/middleware/auth.js", () => ({
  authenticateToken: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  requireAdmin: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("../../api/lib/database.js", () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

vi.mock("../../api/services/ipService.js", () => ({
  listAllIPs: (...args: any[]) => mockListAllIPs(...args),
  getIPAddress: (...args: any[]) => mockGetIPAddress(...args),
  allocateIP: vi.fn(),
  deleteIPAddress: vi.fn(),
  assignIPs: vi.fn(),
  shareIPs: vi.fn(),
  updateIPReverseDNS: vi.fn(),
  listIPv6Pools: vi.fn(),
  listIPv6Ranges: vi.fn(),
  createIPv6Range: vi.fn(),
  deleteIPv6Range: vi.fn(),
  listVLANs: vi.fn(),
  deleteVLAN: vi.fn(),
  listFirewalls: vi.fn(),
  createFirewall: vi.fn(),
  getFirewall: vi.fn(),
  updateFirewall: vi.fn(),
  deleteFirewall: vi.fn(),
  getFirewallRules: vi.fn(),
  updateFirewallRules: vi.fn(),
  getFirewallDevices: vi.fn(),
  attachFirewallDevice: vi.fn(),
  detachFirewallDevice: vi.fn(),
  getFirewallSettings: vi.fn(),
  updateFirewallSettings: vi.fn(),
  listFirewallTemplates: vi.fn(),
  getFirewallTemplate: vi.fn(),
}));

vi.mock("../../api/services/linodeService.js", () => ({
  linodeService: {
    listIPv6Ranges: (...args: any[]) => mockListIPv6Ranges(...args),
    getIPv6Range: (...args: any[]) => mockGetIPv6Range(...args),
    getLinodeInstanceIPs: (...args: any[]) => mockGetLinodeInstanceIPs(...args),
    getAccountNetworkingIPs: (...args: any[]) => mockGetAccountNetworkingIPs(...args),
    updateIPAddressReverseDNS: (...args: any[]) => mockUpdateIPAddressReverseDNS(...args),
  },
}));

vi.mock("../../api/services/activityLogger.js", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

import adminNetworkingRoutes from "../../api/routes/admin/networking.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { id: "00000000-0000-0000-0000-000000000001", organizationId: null, role: "admin" };
    next();
  });
  app.use("/api/admin/networking", adminNetworkingRoutes);
  return app;
}

describe("admin networking routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enriches IPv6 rDNS from per-address detail when the list response is empty", async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: "vps-1", label: "test-vps", provider_instance_id: "95646725" }],
    });
    mockListAllIPs.mockResolvedValue({
      data: [
        {
          address: "2600:3c04::1",
          prefix: 64,
          type: "ipv6",
          public: true,
          rdns: null,
          instanceId: "95646725",
          region: "ca-central",
        },
      ],
      pages: 1,
      total: 1,
    });
    mockGetIPAddress.mockResolvedValue({
      address: "2600:3c04::1",
      rdns: "host.example.com",
    });

    const response = await request(createApp()).get("/api/admin/networking/ips");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].rdns).toBe("host.example.com");
  });

  it("keeps IPv6 rDNS null when the detail response also has no value", async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: "vps-1", label: "test-vps", provider_instance_id: "95646725" }],
    });
    mockListAllIPs.mockResolvedValue({
      data: [
        {
          address: "2600:3c04::2",
          prefix: 64,
          type: "ipv6",
          public: true,
          rdns: null,
          instanceId: "95646725",
          region: "ca-central",
        },
      ],
      pages: 1,
      total: 1,
    });
    mockGetIPAddress.mockResolvedValue({
      address: "2600:3c04::2",
      rdns: null,
    });

    const response = await request(createApp()).get("/api/admin/networking/ips");

    expect(response.status).toBe(200);
    expect(response.body.data[0].rdns).toBeNull();
  });

  it("includes IPv6 prefix context and VPS metadata in /ips rows when available", async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: "9455c0a2-d07d-496f-a7c4-1e53ac9d6047", label: "test-vps", provider_instance_id: "95646725" }],
    });
    mockListAllIPs.mockResolvedValue({
      data: [
        {
          address: "2600:3c04::1000",
          prefix: 64,
          type: "ipv6",
          public: true,
          rdns: "mail.example.com",
          instanceId: "95646725",
          region: "ca-central",
        },
      ],
      pages: 1,
      total: 1,
    });
    mockGetLinodeInstanceIPs.mockResolvedValue({
      ipv6: {
        global: [
          {
            range: "2600:3c04:e001:364::",
            prefix: 64,
            region: "ca-central",
            route_target: "2600:3c04::1",
          },
        ],
      },
    });

    const response = await request(createApp()).get("/api/admin/networking/ips");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].vpsId).toBe("9455c0a2-d07d-496f-a7c4-1e53ac9d6047");
    expect(response.body.data[0].vpsLabel).toBe("test-vps");
    expect(response.body.data[0].ipv6Prefixes).toEqual([
      {
        range: "2600:3c04:e001:364::",
        prefixLength: 64,
        region: "ca-central",
        routeTarget: "2600:3c04::1",
      },
    ]);
  });

  it("returns IPv4 rows unchanged when no IPv6 prefix context applies", async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: "vps-1", label: "test-vps", provider_instance_id: "95646725" }],
    });
    mockListAllIPs.mockResolvedValue({
      data: [
        {
          address: "139.177.199.181",
          prefix: 24,
          type: "ipv4",
          public: true,
          rdns: "host.example.com",
          instanceId: "95646725",
          region: "ca-central",
        },
      ],
      pages: 1,
      total: 1,
    });

    const response = await request(createApp()).get("/api/admin/networking/ips");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].address).toBe("139.177.199.181");
    expect(response.body.data[0].ipv6Prefixes).toBeUndefined();
  });

  it("safely falls back when instance IPv6 details are unavailable", async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: "vps-1", label: "test-vps", provider_instance_id: "95646725" }],
    });
    mockListAllIPs.mockResolvedValue({
      data: [
        {
          address: "2600:3c04::2000",
          prefix: 64,
          type: "ipv6",
          public: true,
          rdns: "host.example.com",
          instanceId: "95646725",
          region: "ca-central",
        },
      ],
      pages: 1,
      total: 1,
    });
    mockGetLinodeInstanceIPs.mockRejectedValue(new Error("provider timeout"));

    const response = await request(createApp()).get("/api/admin/networking/ips");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].address).toBe("2600:3c04::2000");
    expect(response.body.data[0].ipv6Prefixes).toBeUndefined();
  });

  it("keeps panel-owned IPv6 ranges by deriving instanceIds from range detail", async () => {
    mockQuery.mockResolvedValue({
      rows: [{ provider_instance_id: "95646725" }],
    });
    mockListIPv6Ranges.mockResolvedValue([
      {
        range: "2600:3c04:2000:3cff::",
        prefix: 64,
        region: "ca-central",
        route_target: "2600:3c04::1",
        created: "",
        linodes: [],
      },
    ]);
    mockGetIPv6Range.mockResolvedValue({
      range: "2600:3c04:2000:3cff::",
      prefix: 64,
      region: "ca-central",
      linodes: [95646725],
    });

    const response = await request(createApp()).get("/api/admin/networking/ipv6/ranges");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].instanceIds).toEqual(["95646725"]);
    expect(response.body.data[0].instanceId).toBe("95646725");
  });

  it("returns all matching panel instanceIds for shared IPv6 ranges", async () => {
    mockQuery.mockResolvedValue({
      rows: [
        { provider_instance_id: "95646725" },
        { provider_instance_id: "95646726" },
      ],
    });
    mockListIPv6Ranges.mockResolvedValue([
      {
        range: "2600:3c04:2000:3cfe::",
        prefix: 64,
        region: "ca-central",
        route_target: "2600:3c04::1",
        created: "",
        linodes: [],
      },
    ]);
    mockGetIPv6Range.mockResolvedValue({
      range: "2600:3c04:2000:3cfe::",
      prefix: 64,
      region: "ca-central",
      linodes: [95646725, 99999999, 95646726],
    });

    const response = await request(createApp()).get("/api/admin/networking/ipv6/ranges");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].instanceIds).toEqual(["95646725", "95646726"]);
    expect(response.body.data[0].instanceId).toBe("95646725");
  });

  it("lists IPv6 range rDNS records for panel VPS on that range", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ provider_instance_id: "95646725" }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "9455c0a2-d07d-496f-a7c4-1e53ac9d6047",
            label: "test-vps",
            provider_instance_id: "95646725",
          },
        ],
      });
    mockGetIPv6Range.mockResolvedValue({
      range: "2600:3c04:e001:364::",
      linodes: [95646725],
    });
    mockGetAccountNetworkingIPs.mockResolvedValue({
      data: [
        {
          address: "2600:3c04:e001:364::1",
          rdns: "2600-3c04-e001-364--1.nip.io.",
          type: "ipv6",
        },
        {
          address: "2600:3c04:e001:364::2",
          rdns: "x.ip.linodeusercontent.com",
          type: "ipv6",
        },
      ],
    });

    const response = await request(createApp()).get(
      "/api/admin/networking/ipv6/range-rdns-records?range=2600%3A3c04%3Ae001%3A364%3A%3A&prefix=64",
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.records).toHaveLength(1);
    expect(response.body.data.records[0].address).toBe("2600:3c04:e001:364::1");
    expect(response.body.data.vpsInstances).toHaveLength(1);
    expect(response.body.data.vpsInstances[0].id).toBe("9455c0a2-d07d-496f-a7c4-1e53ac9d6047");
  });

  it("rejects IPv6 range rDNS when address is not on the Linode instance", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ provider_instance_id: "95646725" }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "9455c0a2-d07d-496f-a7c4-1e53ac9d6047",
            label: "test-vps",
            provider_instance_id: "95646725",
          },
        ],
      });
    mockGetIPv6Range.mockResolvedValue({
      range: "2600:3c04:e001:364::",
      linodes: [95646725],
    });
    mockGetLinodeInstanceIPs.mockResolvedValue({
      ipv6: {
        global: [{ range: "2600:3c04:e001:364::", prefix: 64 }],
      },
    });

    const response = await request(createApp())
      .post("/api/admin/networking/ipv6/range-rdns")
      .send({
        range: "2600:3c04:e001:364::",
        prefix: 64,
        address: "2600:3c04:e001:365::1",
        rdns: "x.example.com",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(mockUpdateIPAddressReverseDNS).not.toHaveBeenCalled();
  });

  it("updates IPv6 range rDNS when address is in range and assigned to VPS", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ provider_instance_id: "95646725" }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "9455c0a2-d07d-496f-a7c4-1e53ac9d6047",
            label: "test-vps",
            provider_instance_id: "95646725",
          },
        ],
      });
    mockGetIPv6Range.mockResolvedValue({
      range: "2600:3c04:e001:364::",
      linodes: [95646725],
    });
    mockGetLinodeInstanceIPs.mockResolvedValue({
      ipv6: {
        global: [{ range: "2600:3c04:e001:364::", prefix: 64 }],
      },
    });
    mockUpdateIPAddressReverseDNS.mockResolvedValue(undefined);

    const response = await request(createApp())
      .post("/api/admin/networking/ipv6/range-rdns")
      .send({
        range: "2600:3c04:e001:364::",
        prefix: 64,
        address: "2600:3c04:e001:364::3",
        rdns: "mail.example.com",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockUpdateIPAddressReverseDNS).toHaveBeenCalledWith("2600:3c04:e001:364::3", "mail.example.com");
  });
});
