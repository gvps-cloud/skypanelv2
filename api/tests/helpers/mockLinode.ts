import { vi } from "vitest";
import type { IProviderService } from "../../services/providers/IProviderService.js";

export type MockLinodeService = Partial<{
  [K in keyof IProviderService]: ReturnType<typeof vi.fn>;
}>;

export function createMockLinodeService(overrides?: MockLinodeService): MockLinodeService {
  const base: MockLinodeService = {
    getProviderType: vi.fn().mockReturnValue("linode"),
    createInstance: vi.fn(),
    getInstance: vi.fn(),
    listInstances: vi.fn().mockResolvedValue([]),
    performAction: vi.fn(),
    getPlans: vi.fn().mockResolvedValue([]),
    getImages: vi.fn().mockResolvedValue([]),
    getRegions: vi.fn().mockResolvedValue([]),
    validateCredentials: vi.fn().mockResolvedValue(true),
    listIPs: vi.fn().mockResolvedValue({ data: [], pages: 1, total: 0 }),
    getIPAddress: vi.fn(),
    allocateIP: vi.fn(),
    deleteIPAddress: vi.fn(),
    assignIPs: vi.fn(),
    shareIPs: vi.fn(),
    updateIPReverseDNS: vi.fn(),
    listIPv6Pools: vi.fn().mockResolvedValue([]),
    listIPv6Ranges: vi.fn().mockResolvedValue([]),
    createIPv6Range: vi.fn(),
    deleteIPv6Range: vi.fn(),
    listVLANs: vi.fn().mockResolvedValue([]),
    deleteVLAN: vi.fn(),
    listFirewalls: vi.fn().mockResolvedValue({ data: [], pages: 1, total: 0 }),
    createFirewall: vi.fn(),
    getFirewall: vi.fn(),
    updateFirewall: vi.fn(),
    deleteFirewall: vi.fn(),
    getFirewallRules: vi.fn(),
    updateFirewallRules: vi.fn(),
    getFirewallDevices: vi.fn().mockResolvedValue([]),
    attachFirewallDevice: vi.fn(),
    detachFirewallDevice: vi.fn(),
    getFirewallSettings: vi.fn(),
    updateFirewallSettings: vi.fn(),
    listFirewallTemplates: vi.fn().mockResolvedValue([]),
    getFirewallTemplate: vi.fn(),
    listDisks: vi.fn().mockResolvedValue([]),
    getDisk: vi.fn(),
    createDisk: vi.fn(),
    updateDisk: vi.fn(),
    resizeDisk: vi.fn(),
    cloneDisk: vi.fn(),
    resetDiskPassword: vi.fn(),
    deleteDisk: vi.fn(),
  };

  const service = { ...base, ...overrides };

  vi.mock("../../services/linodeService.js", () => ({
    linodeService: service,
  }));

  return service;
}

export function mockLinodeDisk(overrides?: Partial<{
  id: number;
  label: string;
  status: string;
  size: number;
  filesystem: string;
  created: string;
  updated: string;
}>) {
  return {
    id: 12345,
    label: "Test Disk",
    status: "ready",
    size: 50000,
    filesystem: "ext4",
    created: "2024-01-01T00:00:00Z",
    updated: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function mockLinodeInstance(overrides?: Partial<{
  id: string;
  label: string;
  status: "running" | "stopped" | "provisioning" | "rebooting" | "error" | "unknown";
  region: string;
  created: string;
  specs: { vcpus: number; memory: number; disk: number; transfer: number };
}>) {
  return {
    id: "99999",
    label: "TestInstance",
    status: "running",
    region: "us-east",
    ipv4: ["192.168.1.1"],
    ipv6: "fe80::1/64",
    specs: { vcpus: 2, memory: 4096, disk: 80, transfer: 4000 },
    created: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function mockLinodeError(reason: string, code?: number) {
  return {
    errors: [{ reason, code }],
  };
}
