/**
 * IPAM Service - IP Address Management API client
 * Handles admin networking operations: IPs, IPv6 ranges/pools, VLANs, Firewalls
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

// ── Types ──

export interface IPAMIPAddress {
  address: string;
  gateway?: string;
  subnetMask?: string;
  prefix: number;
  type: "ipv4" | "ipv6" | "ipv6/pool" | "ipv6/range";
  public: boolean;
  rdns: string | null;
  instanceId: string | null;
  region: string;
  ipv6Prefixes?: Array<{
    range: string;
    prefixLength: number;
    region: string;
    routeTarget: string | null;
  }>;
  vpsId?: string;
  vpsLabel?: string;
}

export interface IPAMIPv6Range {
  range: string;
  instanceId: string | null;
  instanceIds: string[];
  routeTarget: string | null;
  region: string;
  prefixLength: number;
  created: string;
}

export interface IPAMIPv6Pool {
  range: string;
  instanceId: string | null;
  region: string;
  prefixLength: number;
}

export interface IPAMVLAN {
  label: string;
  region: string;
  instanceIds: string[];
  created: string;
}

// ── Firewall Types ──

export type FirewallProtocol = 'TCP' | 'UDP' | 'ICMP' | 'IPENCAP' | 'GRE';
export type FirewallAction = 'ACCEPT' | 'DROP';
export type FirewallStatus = 'enabled' | 'disabled';

export interface IPAMFirewallRule {
  protocol: FirewallProtocol;
  ports?: string;
  addresses: { ipv4?: string[]; ipv6?: string[] };
  action: FirewallAction;
  label?: string;
  description?: string;
}

export interface IPAMFirewallRules {
  inbound: IPAMFirewallRule[];
  outbound: IPAMFirewallRule[];
  inbound_policy: FirewallAction;
  outbound_policy: FirewallAction;
}

export interface IPAMFirewallEntity {
  id: number;
  type: 'linode' | 'linode_interface' | 'nodebalancer';
  label: string;
  url: string;
}

export interface IPAMFirewall {
  id: number;
  label: string;
  status: FirewallStatus;
  rules: IPAMFirewallRules;
  entities: IPAMFirewallEntity[];
  tags: string[];
  created: string;
  updated: string;
}

export interface IPAMFirewallDevice {
  id: number;
  entity: IPAMFirewallEntity;
  created: string;
  updated: string;
}

export interface IPAMFirewallSettings {
  default_firewall_ids: {
    linode: number | null;
    nodebalancer: number | null;
  };
}

export interface IPAMFirewallTemplate {
  slug: string;
  label: string;
  description: string;
  rules: IPAMFirewallRules;
}

export interface CreateFirewallRequest {
  label: string;
  rules: {
    inbound_policy: FirewallAction;
    outbound_policy: FirewallAction;
    inbound?: IPAMFirewallRule[];
    outbound?: IPAMFirewallRule[];
  };
  tags?: string[];
}

// ── Helpers ──

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(response: Response): Promise<{ success: boolean; data?: T; error?: string; pages?: number; total?: number }> {
  const json = await response.json();
  if (!response.ok) {
    return { success: false, error: json.error || "Request failed" };
  }
  return {
    success: true,
    data: json.data,
    pages: json.pages,
    total: json.total,
  };
}

// ── IP Addresses ──

export async function listIPs(page = 1, pageSize = 100) {
  const res = await fetch(
    `${API_BASE_URL}/admin/networking/ips?page=${page}&pageSize=${pageSize}`,
    { headers: getAuthHeaders() }
  );
  return handleResponse<IPAMIPAddress[]>(res);
}

export async function getIPAddress(address: string) {
  const res = await fetch(
    `${API_BASE_URL}/admin/networking/ips/${encodeURIComponent(address)}`,
    { headers: getAuthHeaders() }
  );
  return handleResponse<IPAMIPAddress>(res);
}

export async function allocateIP(instanceId: string, publicIp: boolean, type: "ipv4" | "ipv6") {
  const res = await fetch(`${API_BASE_URL}/admin/networking/ips`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ instanceId, public: publicIp, type }),
  });
  return handleResponse<IPAMIPAddress>(res);
}

export async function deleteIPAddress(instanceId: string, address: string) {
  const res = await fetch(
    `${API_BASE_URL}/admin/networking/ips/${encodeURIComponent(instanceId)}/${encodeURIComponent(address)}`,
    { method: "DELETE", headers: getAuthHeaders() }
  );
  return handleResponse<void>(res);
}

export async function assignIPs(
  assignments: Array<{ address: string; instanceId: string }>,
  region: string
) {
  const res = await fetch(`${API_BASE_URL}/admin/networking/ips/assign`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ assignments, region }),
  });
  return handleResponse<void>(res);
}

export async function shareIPs(instanceId: string, ips: string[]) {
  const res = await fetch(`${API_BASE_URL}/admin/networking/ips/share`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ instanceId, ips }),
  });
  return handleResponse<void>(res);
}

export async function updateReverseDNS(address: string, rdns: string | null) {
  const res = await fetch(
    `${API_BASE_URL}/admin/networking/ips/${encodeURIComponent(address)}/rdns`,
    {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ rdns }),
    }
  );
  return handleResponse<IPAMIPAddress>(res);
}

// ── IPv6 ──

export async function listIPv6Pools() {
  const res = await fetch(`${API_BASE_URL}/admin/networking/ipv6/pools`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<IPAMIPv6Pool[]>(res);
}

export async function listIPv6Ranges() {
  const res = await fetch(`${API_BASE_URL}/admin/networking/ipv6/ranges`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<IPAMIPv6Range[]>(res);
}

export async function createIPv6Range(prefixLength: number, instanceId?: string, routeTarget?: string) {
  const res = await fetch(`${API_BASE_URL}/admin/networking/ipv6/ranges`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ prefixLength, instanceId, routeTarget }),
  });
  return handleResponse<{ range: string; routeTarget: string }>(res);
}

export async function deleteIPv6Range(range: string) {
  const res = await fetch(
    `${API_BASE_URL}/admin/networking/ipv6/ranges/${encodeURIComponent(range)}`,
    { method: "DELETE", headers: getAuthHeaders() }
  );
  return handleResponse<void>(res);
}

export interface IPv6RangeRdnsVpsRow {
  id: string;
  label: string;
  provider_instance_id: string;
}

export interface IPv6RangeRdnsRecordsPayload {
  records: Array<{ address: string; rdns: string }>;
  vpsInstances: IPv6RangeRdnsVpsRow[];
}

export async function getIPv6RangeRdnsRecords(range: string, prefixLength: number) {
  const params = new URLSearchParams({ range, prefix: String(prefixLength) });
  const res = await fetch(
    `${API_BASE_URL}/admin/networking/ipv6/range-rdns-records?${params.toString()}`,
    { headers: getAuthHeaders() }
  );
  return handleResponse<IPv6RangeRdnsRecordsPayload>(res);
}

export async function updateIPv6RangeRdns(
  range: string,
  prefixLength: number,
  address: string,
  rdns: string | null
) {
  const res = await fetch(`${API_BASE_URL}/admin/networking/ipv6/range-rdns`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ range, prefix: prefixLength, address, rdns }),
  });
  const json = await res.json();
  if (!res.ok) {
    return { success: false as const, error: json.error || "Request failed" };
  }
  return { success: true as const, rdns: json.rdns as string | null };
}

// ── VLANs ──

export async function listVLANs() {
  const res = await fetch(`${API_BASE_URL}/admin/networking/vlans`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<IPAMVLAN[]>(res);
}

export async function deleteVLAN(regionId: string, label: string) {
  const res = await fetch(
    `${API_BASE_URL}/admin/networking/vlans/${encodeURIComponent(regionId)}/${encodeURIComponent(label)}`,
    { method: "DELETE", headers: getAuthHeaders() }
  );
  return handleResponse<void>(res);
}

// ── Firewalls ──

export async function listFirewalls() {
  const res = await fetch(`${API_BASE_URL}/admin/networking/firewalls`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<IPAMFirewall[]>(res);
}

export async function createFirewall(data: CreateFirewallRequest) {
  const res = await fetch(`${API_BASE_URL}/admin/networking/firewalls`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<IPAMFirewall>(res);
}

export async function getFirewall(id: number) {
  const res = await fetch(`${API_BASE_URL}/admin/networking/firewalls/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<IPAMFirewall>(res);
}

export async function updateFirewall(id: number, updates: { label?: string; status?: FirewallStatus; tags?: string[] }) {
  const res = await fetch(`${API_BASE_URL}/admin/networking/firewalls/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });
  return handleResponse<IPAMFirewall>(res);
}

export async function deleteFirewall(id: number) {
  const res = await fetch(`${API_BASE_URL}/admin/networking/firewalls/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse<void>(res);
}

export async function getFirewallRules(id: number) {
  const res = await fetch(`${API_BASE_URL}/admin/networking/firewalls/${id}/rules`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<IPAMFirewallRules>(res);
}

export async function updateFirewallRules(id: number, rules: IPAMFirewallRules) {
  const res = await fetch(`${API_BASE_URL}/admin/networking/firewalls/${id}/rules`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(rules),
  });
  return handleResponse<IPAMFirewallRules>(res);
}

export async function getFirewallDevices(id: number) {
  const res = await fetch(`${API_BASE_URL}/admin/networking/firewalls/${id}/devices`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<IPAMFirewallDevice[]>(res);
}

export async function attachFirewallDevice(firewallId: number, type: string, entityId: number) {
  const res = await fetch(`${API_BASE_URL}/admin/networking/firewalls/${firewallId}/devices`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ type, entityId }),
  });
  return handleResponse<IPAMFirewallDevice>(res);
}

export async function detachFirewallDevice(firewallId: number, deviceId: number) {
  const res = await fetch(
    `${API_BASE_URL}/admin/networking/firewalls/${firewallId}/devices/${deviceId}`,
    { method: "DELETE", headers: getAuthHeaders() }
  );
  return handleResponse<void>(res);
}

export async function getFirewallHistory(id: number) {
  const res = await fetch(`${API_BASE_URL}/admin/networking/firewalls/${id}/history`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<Array<Record<string, unknown>>>(res);
}

export async function getFirewallSettings() {
  const res = await fetch(`${API_BASE_URL}/admin/networking/firewall-settings`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<IPAMFirewallSettings>(res);
}

export async function updateFirewallSettings(settings: IPAMFirewallSettings) {
  const res = await fetch(`${API_BASE_URL}/admin/networking/firewall-settings`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(settings),
  });
  return handleResponse<IPAMFirewallSettings>(res);
}

export async function listFirewallTemplates() {
  const res = await fetch(`${API_BASE_URL}/admin/networking/firewall-templates`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<IPAMFirewallTemplate[]>(res);
}

export async function getFirewallTemplate(slug: string) {
  const res = await fetch(`${API_BASE_URL}/admin/networking/firewall-templates/${encodeURIComponent(slug)}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<IPAMFirewallTemplate>(res);
}
