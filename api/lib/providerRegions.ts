export const DEFAULT_LINODE_ALLOWED_REGIONS = [
  "us-east",
  "us-west",
  "us-central",
  "us-southeast",
  "eu-west",
  "eu-central",
  "ap-south",
  "ap-southeast",
  "ap-northeast",
  "ca-central",
];

/**
 * Linode Speed Test URL mapping
 * Maps region IDs to their corresponding speed test server URLs
 * Used for client-side latency testing
 * @see https://www.linode.com/speed-test/
 */
export const LINODE_SPEED_TEST_URLS: Record<string, string> = {
  // Americas
  "us-southeast": "https://speedtest.atlanta.linode.com/",
  "us-ord": "https://speedtest.chicago.linode.com/",
  "us-central": "https://speedtest.dallas.linode.com/",
  "us-west": "https://speedtest.fremont.linode.com/",
  "us-lax": "https://speedtest.los-angeles.linode.com/",
  "us-mia": "https://speedtest.miami.linode.com/",
  "us-east": "https://speedtest.newark.linode.com/",
  "br-gru": "https://speedtest.sao-paulo.linode.com/",
  "us-sea": "https://speedtest.seattle.linode.com/",
  "ca-central": "https://speedtest.toronto1.linode.com/",
  "us-iad": "https://speedtest.washington.linode.com/",
  // Europe
  "nl-ams": "https://speedtest.amsterdam.linode.com/",
  "eu-central": "https://speedtest.frankfurt.linode.com/",
  "de-fra-2": "https://de-fra-2.speedtest.linode.com/",
  "eu-west": "https://speedtest.london.linode.com/",
  "gb-lon": "https://gb-lon.speedtest.linode.com/",
  "es-mad": "https://speedtest.madrid.linode.com/",
  "it-mil": "https://speedtest.milan.linode.com/",
  "fr-par": "https://speedtest.paris.linode.com/",
  "se-sto": "https://speedtest.stockholm.linode.com/",
  // Asia-Pacific
  "in-maa": "https://speedtest.chennai.linode.com/",
  "id-cgk": "https://speedtest.jakarta.linode.com/",
  "ap-west": "https://speedtest.mumbai1.linode.com/",
  "in-bom-2": "https://in-bom-2.speedtest.linode.com/",
  "jp-osa": "https://speedtest.osaka.linode.com/",
  "ap-south": "https://speedtest.singapore.linode.com/",
  "sg-sin-2": "https://sg-sin-2.speedtest.linode.com/",
  "ap-northeast": "https://speedtest.tokyo2.linode.com/",
  "jp-tyo-3": "https://jp-tyo-3.speedtest.linode.com/",
  "au-mel": "https://au-mel.speedtest.linode.com/",
  "ap-southeast": "https://speedtest.sydney.linode.com/",
};

/**
 * Get the speed test URL for a given region ID
 * @param regionId - The Linode region ID (e.g., "us-east", "eu-central")
 * @returns The speed test URL or undefined if not available
 */
export const getSpeedTestUrl = (regionId: string): string | undefined => {
  const normalized = regionId.toLowerCase().trim();
  return LINODE_SPEED_TEST_URLS[normalized];
};

const normalizedLinodeDefaults = new Set(
  DEFAULT_LINODE_ALLOWED_REGIONS.map((region) => region.toLowerCase())
);

export const normalizeRegionList = (regions: string[]): string[] =>
  Array.from(
    new Set(
      regions
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0)
    )
  );

export const matchesDefaultAllowedRegions = (
  normalizedRegions: string[]
): boolean => {
  if (normalizedRegions.length === 0) {
    return false;
  }

  if (normalizedRegions.length !== normalizedLinodeDefaults.size) {
    return false;
  }
  return normalizedRegions.every((region) =>
    normalizedLinodeDefaults.has(region)
  );
};

export const shouldFilterByAllowedRegions = (
  normalizedRegions: string[]
): boolean => normalizedRegions.length > 0;

export const parseStoredAllowedRegions = (rawValue: unknown): string[] => {
  if (!rawValue) {
    return [];
  }

  if (Array.isArray(rawValue)) {
    return normalizeRegionList(
      rawValue.filter((value: unknown): value is string => typeof value === "string")
    );
  }

  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return normalizeRegionList(
          parsed.filter((value: unknown): value is string => typeof value === "string")
        );
      }
    } catch (err) {
      console.warn("Failed to parse stored allowed_regions value", err);
    }
  }

  if (typeof rawValue === "object" && rawValue !== null) {
    // Handle JSONB objects that might resemble {"0": "region"}
    try {
      const entries = Object.values(rawValue);
      if (entries.length > 0) {
        return normalizeRegionList(
          entries.filter((value: unknown): value is string => typeof value === "string")
        );
      }
    } catch (err) {
      console.warn("Failed to normalize structured allowed_regions value", err);
    }
  }

  return [];
};
