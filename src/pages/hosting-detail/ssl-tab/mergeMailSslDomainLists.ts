/** Rows returned from `/hosting/dns/:id/domains` (with or without `withSsl`). */
export type HostingDnsDomainRow = {
  id: string;
  domain: string;
  sslActive?: boolean;
  forceSsl?: boolean;
  is_primary?: boolean;
};

/**
 * `withSsl=true` may omit mapped domains that have no web SSL metadata yet. Mail Let's Encrypt
 * is keyed by domain mapping id (`POST /v2/domains/{domain_id}/letsencrypt_mail`), so the mail SSL
 * picker should include every website mapping from the plain domains listing while preserving
 * ssl flags from the `withSsl` response when present.
 */
export function mergeDomainsForMailSsl(
  sslDomains: HostingDnsDomainRow[],
  allMappings: HostingDnsDomainRow[],
): HostingDnsDomainRow[] {
  const sslById = new Map(sslDomains.map((d) => [d.id, d]));
  const seen = new Set<string>();
  const merged: HostingDnsDomainRow[] = [];

  for (const d of allMappings) {
    if (!d.id || seen.has(d.id)) continue;
    seen.add(d.id);
    const ssl = sslById.get(d.id);
    merged.push({
      id: d.id,
      domain: d.domain,
      is_primary: d.is_primary,
      sslActive: ssl?.sslActive ?? false,
      forceSsl: ssl?.forceSsl ?? false,
    });
  }

  for (const d of sslDomains) {
    if (!d.id || seen.has(d.id)) continue;
    seen.add(d.id);
    merged.push({
      id: d.id,
      domain: d.domain,
      is_primary: d.is_primary,
      sslActive: Boolean(d.sslActive),
      forceSsl: Boolean(d.forceSsl),
    });
  }

  merged.sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return a.domain.localeCompare(b.domain);
  });

  return merged;
}
