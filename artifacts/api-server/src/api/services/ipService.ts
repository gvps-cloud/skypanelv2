/**
 * IP Service
 * Orchestrates IP management operations across providers.
 * All operations go through the provider abstraction layer for multi-provider support.
 */

import { getProviderServiceByType } from './providerService.js';
import {
  ProviderIPAddress,
  ProviderIPv6Range,
  ProviderIPv6Pool,
  ProviderVLAN,
  ProviderAllocateIPRequest,
  ProviderAssignIPsRequest,
  ProviderShareIPsRequest,
  ProviderCreateIPv6RangeRequest,
  ProviderFirewall,
  FirewallRules,
  FirewallDevice,
  FirewallSettings,
  FirewallTemplate,
  FirewallStatus,
  CreateFirewallParams,
} from './providers/IProviderService.js';

async function getActiveProvider() {
  return getProviderServiceByType('linode');
}

// ── IP Address Management ──

export async function listAllIPs(page: number = 1, pageSize: number = 100) {
  const provider = await getActiveProvider();
  return provider.listIPs(page, pageSize);
}

export async function getIPAddress(address: string): Promise<ProviderIPAddress> {
  const provider = await getActiveProvider();
  return provider.getIPAddress(address);
}

export async function allocateIP(request: ProviderAllocateIPRequest): Promise<ProviderIPAddress> {
  const provider = await getActiveProvider();
  return provider.allocateIP(request);
}

export async function deleteIPAddress(instanceId: string, address: string): Promise<void> {
  const provider = await getActiveProvider();
  return provider.deleteIPAddress(instanceId, address);
}

export async function assignIPs(request: ProviderAssignIPsRequest): Promise<void> {
  const provider = await getActiveProvider();
  return provider.assignIPs(request);
}

export async function shareIPs(request: ProviderShareIPsRequest): Promise<void> {
  const provider = await getActiveProvider();
  return provider.shareIPs(request);
}

export async function updateIPReverseDNS(address: string, rdns: string | null): Promise<ProviderIPAddress> {
  const provider = await getActiveProvider();
  return provider.updateIPReverseDNS(address, rdns);
}

// ── IPv6 Management ──

export async function listIPv6Pools(): Promise<ProviderIPv6Pool[]> {
  const provider = await getActiveProvider();
  return provider.listIPv6Pools();
}

export async function listIPv6Ranges(): Promise<ProviderIPv6Range[]> {
  const provider = await getActiveProvider();
  return provider.listIPv6Ranges();
}

export async function createIPv6Range(request: ProviderCreateIPv6RangeRequest): Promise<{ range: string; routeTarget: string }> {
  const provider = await getActiveProvider();
  return provider.createIPv6Range(request);
}

export async function deleteIPv6Range(range: string): Promise<void> {
  const provider = await getActiveProvider();
  return provider.deleteIPv6Range(range);
}

// ── VLAN Management ──

export async function listVLANs(): Promise<ProviderVLAN[]> {
  const provider = await getActiveProvider();
  return provider.listVLANs();
}

export async function deleteVLAN(regionId: string, label: string): Promise<void> {
  const provider = await getActiveProvider();
  return provider.deleteVLAN(regionId, label);
}

// ── Firewall Management ──

export async function listFirewalls(): Promise<{ data: ProviderFirewall[]; pages: number; total: number }> {
  const provider = await getActiveProvider();
  return provider.listFirewalls();
}

export async function createFirewall(params: CreateFirewallParams): Promise<ProviderFirewall> {
  const provider = await getActiveProvider();
  return provider.createFirewall(params);
}

export async function getFirewall(firewallId: number): Promise<ProviderFirewall> {
  const provider = await getActiveProvider();
  return provider.getFirewall(firewallId);
}

export async function updateFirewall(firewallId: number, updates: { label?: string; status?: FirewallStatus; tags?: string[] }): Promise<ProviderFirewall> {
  const provider = await getActiveProvider();
  return provider.updateFirewall(firewallId, updates);
}

export async function deleteFirewall(firewallId: number): Promise<void> {
  const provider = await getActiveProvider();
  return provider.deleteFirewall(firewallId);
}

export async function getFirewallRules(firewallId: number): Promise<FirewallRules> {
  const provider = await getActiveProvider();
  return provider.getFirewallRules(firewallId);
}

export async function updateFirewallRules(firewallId: number, rules: FirewallRules): Promise<FirewallRules> {
  const provider = await getActiveProvider();
  return provider.updateFirewallRules(firewallId, rules);
}

export async function getFirewallDevices(firewallId: number): Promise<FirewallDevice[]> {
  const provider = await getActiveProvider();
  return provider.getFirewallDevices(firewallId);
}

export async function attachFirewallDevice(firewallId: number, type: string, entityId: number): Promise<FirewallDevice> {
  const provider = await getActiveProvider();
  return provider.attachFirewallDevice(firewallId, type, entityId);
}

export async function detachFirewallDevice(firewallId: number, deviceId: number): Promise<void> {
  const provider = await getActiveProvider();
  return provider.detachFirewallDevice(firewallId, deviceId);
}

export async function getFirewallSettings(): Promise<FirewallSettings> {
  const provider = await getActiveProvider();
  return provider.getFirewallSettings();
}

export async function updateFirewallSettings(settings: FirewallSettings): Promise<FirewallSettings> {
  const provider = await getActiveProvider();
  return provider.updateFirewallSettings(settings);
}

export async function listFirewallTemplates(): Promise<FirewallTemplate[]> {
  const provider = await getActiveProvider();
  return provider.listFirewallTemplates();
}

export async function getFirewallTemplate(slug: string): Promise<FirewallTemplate> {
  const provider = await getActiveProvider();
  return provider.getFirewallTemplate(slug);
}
