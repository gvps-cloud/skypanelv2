/**
 * IPv6 helpers for range membership checks (rDNS, networking validation).
 */

/**
 * Expand a compressed IPv6 address to a 128-bit integer.
 * Returns null if the input cannot be parsed as IPv6.
 */
export function expandIPv6(address: string): bigint | null {
  try {
    const bare = address.split("/")[0].trim();
    const halves = bare.split("::");
    if (halves.length > 2) return null;
    const left = halves[0] ? halves[0].split(":") : [];
    const right = halves[1] ? halves[1].split(":") : [];
    const missing = 8 - left.length - right.length;
    const groups = [...left, ...Array(missing).fill("0"), ...right];
    if (groups.length !== 8) return null;
    let result = BigInt(0);
    for (const g of groups) {
      result = (result << BigInt(16)) | BigInt(parseInt(g || "0", 16));
    }
    return result;
  } catch {
    return null;
  }
}

/** True if candidateAddress falls within rangeBase/prefixLen */
export function ipv6AddressInRange(
  candidateAddress: string,
  rangeBase: string,
  prefixLen: number,
): boolean {
  const candidate = expandIPv6(candidateAddress);
  const base = expandIPv6(rangeBase);
  if (candidate === null || base === null) return false;
  const mask =
    prefixLen === 0
      ? BigInt(0)
      : (~BigInt(0) << BigInt(128 - prefixLen)) & ((BigInt(1) << BigInt(128)) - BigInt(1));
  return (candidate & mask) === (base & mask);
}

type IPv6RangeEntry = { range?: string; prefix?: number };

function collectInstanceIPv6Ranges(ipv6: Record<string, unknown> | undefined): Array<{ range: string; prefix: number }> {
  const ranges: Array<{ range: string; prefix: number }> = [];
  if (!ipv6 || typeof ipv6 !== "object") return ranges;

  for (const key of ["global", "ranges"] as const) {
    const arr = ipv6[key];
    if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      const e = entry as IPv6RangeEntry;
      if (typeof e?.range === "string" && typeof e?.prefix === "number") {
        ranges.push({ range: e.range, prefix: e.prefix });
      }
    }
  }
  return ranges;
}

/**
 * Whether the given IPv6 address is assigned to this Linode instance (SLAAC, link-local, or global/range).
 */
export function ipv6AddressOwnedByLinodeInstance(
  normalizedAddress: string,
  ipPayload: { ipv6?: Record<string, unknown> } | null | undefined,
): boolean {
  const ipv6 = ipPayload?.ipv6 as Record<string, any> | undefined;
  if (!ipv6) return false;

  if (ipv6?.slaac?.address === normalizedAddress) return true;
  if (ipv6?.link_local?.address === normalizedAddress) return true;

  for (const { range, prefix } of collectInstanceIPv6Ranges(ipv6)) {
    if (ipv6AddressInRange(normalizedAddress, range, prefix)) return true;
  }
  return false;
}

/** Global and named IPv6 prefixes on an instance (for sub-address rDNS within /64 ranges). */
export function getPanelIpv6PrefixRangesForRdns(
  ipPayload: { ipv6?: Record<string, unknown> } | null | undefined,
): Array<{ range: string; prefix: number }> {
  return collectInstanceIPv6Ranges(ipPayload?.ipv6);
}
