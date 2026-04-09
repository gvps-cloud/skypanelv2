import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mockQuery = vi.fn();
const mockListAllIPs = vi.fn();
const mockGetIPAddress = vi.fn();
const mockListIPv6Ranges = vi.fn();
const mockGetIPv6Range = vi.fn();

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
  },
}));

import adminNetworkingRoutes from "../../api/routes/admin/networking.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/networking", adminNetworkingRoutes);
  return app;
}

describe("admin networking routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enriches IPv6 rDNS from per-address detail when the list response is empty", async () => {
    mockQuery.mockResolvedValue({
      rows: [{ provider_instance_id: "95646725" }],
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
      rows: [{ provider_instance_id: "95646725" }],
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
});
