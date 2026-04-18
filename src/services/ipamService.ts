/**
 * IPAM Service - IP Address Management API client
 * Handles admin networking operations: IPs, IPv6 ranges/pools, VLANs, Firewalls
 */

import { apiClient } from '@/lib/api';

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

export type ApiResult<T> = { success: boolean; data?: T; error?: string; pages?: number; total?: number };

async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  try {
    const json = await apiClient.get<{ data?: T; pages?: number; total?: number }>(path);
    return { success: true, data: json.data, pages: json.pages, total: json.total };
  } catch (err: any) {
    return { success: false, error: err.message || 'Request failed' };
  }
}

async function apiMutate<T>(method: 'post' | 'put' | 'delete', path: string, data?: any): Promise<ApiResult<T>> {
  try {
    const json = await apiClient[method]<{ data?: T; pages?: number; total?: number }>(path, data);
    return { success: true, data: json.data, pages: json.pages, total: json.total };
  } catch (err: any) {
    return { success: false, error: err.message || 'Request failed' };
  }
}

// ── IP Addresses ──

export async function listIPs(page = 1, pageSize = 100) {
  return apiGet<IPAMIPAddress[]>(`/admin/networking/ips?page=${page}&pageSize=${pageSize}`);
}

export async function getIPAddress(address: string) {
  return apiGet<IPAMIPAddress>(`/admin/networking/ips/${encodeURIComponent(address)}`);
}

export async function allocateIP(instanceId: string, publicIp: boolean, type: "ipv4" | "ipv6") {
  return apiMutate<IPAMIPAddress>('post', '/admin/networking/ips', { instanceId, public: publicIp, type });
}

export async function deleteIPAddress(instanceId: string, address: string) {
  return apiMutate<void>('delete', `/admin/networking/ips/${encodeURIComponent(instanceId)}/${encodeURIComponent(address)}`);
}

export async function assignIPs(
  assignments: Array<{ address: string; instanceId: string }>,
  region: string
) {
  return apiMutate<void>('post', '/admin/networking/ips/assign', { assignments, region });
}

export async function shareIPs(instanceId: string, ips: string[]) {
  return apiMutate<void>('post', '/admin/networking/ips/share', { instanceId, ips });
}

export async function updateReverseDNS(address: string, rdns: string | null) {
  return apiMutate<IPAMIPAddress>('put', `/admin/networking/ips/${encodeURIComponent(address)}/rdns`, { rdns });
}

// ── IPv6 ──

export async function listIPv6Pools() {
  return apiGet<IPAMIPv6Pool[]>('/admin/networking/ipv6/pools');
}

export async function listIPv6Ranges() {
  return apiGet<IPAMIPv6Range[]>('/admin/networking/ipv6/ranges');
}

export async function createIPv6Range(prefixLength: number, instanceId?: string, routeTarget?: string) {
  return apiMutate<{ range: string; routeTarget: string }>('post', '/admin/networking/ipv6/ranges', { prefixLength, instanceId, routeTarget });
}

export async function deleteIPv6Range(range: string) {
  return apiMutate<void>('delete', `/admin/networking/ipv6/ranges/${encodeURIComponent(range)}`);
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
  return apiGet<IPv6RangeRdnsRecordsPayload>(`/admin/networking/ipv6/range-rdns-records?${params.toString()}`);
}

export async function updateIPv6RangeRdns(
  range: string,
  prefixLength: number,
  address: string,
  rdns: string | null
) {
  try {
    const json = await apiClient.post<{ rdns: string | null }>('/admin/networking/ipv6/range-rdns', { range, prefix: prefixLength, address, rdns });
    return { success: true as const, rdns: json.rdns };
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Request failed' };
  }
}

// ── VLANs ──

export async function listVLANs() {
  return apiGet<IPAMVLAN[]>('/admin/networking/vlans');
}

export async function deleteVLAN(regionId: string, label: string) {
  return apiMutate<void>('delete', `/admin/networking/vlans/${encodeURIComponent(regionId)}/${encodeURIComponent(label)}`);
}

// ── Firewalls ──

export async function listFirewalls() {
  return apiGet<IPAMFirewall[]>('/admin/networking/firewalls');
}

export async function createFirewall(data: CreateFirewallRequest) {
  return apiMutate<IPAMFirewall>('post', '/admin/networking/firewalls', data);
}

export async function getFirewall(id: number) {
  return apiGet<IPAMFirewall>(`/admin/networking/firewalls/${id}`);
}

export async function updateFirewall(id: number, updates: { label?: string; status?: FirewallStatus; tags?: string[] }) {
  return apiMutate<IPAMFirewall>('put', `/admin/networking/firewalls/${id}`, updates);
}

export async function deleteFirewall(id: number) {
  return apiMutate<void>('delete', `/admin/networking/firewalls/${id}`);
}

export async function getFirewallRules(id: number) {
  return apiGet<IPAMFirewallRules>(`/admin/networking/firewalls/${id}/rules`);
}

export async function updateFirewallRules(id: number, rules: IPAMFirewallRules) {
  return apiMutate<IPAMFirewallRules>('put', `/admin/networking/firewalls/${id}/rules`, rules);
}

export async function getFirewallDevices(id: number) {
  return apiGet<IPAMFirewallDevice[]>(`/admin/networking/firewalls/${id}/devices`);
}

export async function attachFirewallDevice(firewallId: number, type: string, entityId: number) {
  return apiMutate<IPAMFirewallDevice>('post', `/admin/networking/firewalls/${firewallId}/devices`, { type, entityId });
}

export async function detachFirewallDevice(firewallId: number, deviceId: number) {
  return apiMutate<void>('delete', `/admin/networking/firewalls/${firewallId}/devices/${deviceId}`);
}

export async function getFirewallHistory(id: number) {
  return apiGet<Array<Record<string, unknown>>>(`/admin/networking/firewalls/${id}/history`);
}

export async function getFirewallSettings() {
  return apiGet<IPAMFirewallSettings>('/admin/networking/firewall-settings');
}

export async function updateFirewallSettings(settings: IPAMFirewallSettings) {
  return apiMutate<IPAMFirewallSettings>('put', '/admin/networking/firewall-settings', settings);
}

export async function listFirewallTemplates() {
  return apiGet<IPAMFirewallTemplate[]>('/admin/networking/firewall-templates');
}

export async function getFirewallTemplate(slug: string) {
  return apiGet<IPAMFirewallTemplate>(`/admin/networking/firewall-templates/${encodeURIComponent(slug)}`);
}
