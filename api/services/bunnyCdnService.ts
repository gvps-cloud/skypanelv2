import https from "https";

export interface BunnyCdnConfig {
  enabled: boolean;
  ipv4Url: string;
  ipv6Url: string;
  refreshIntervalMs: number;
}

class BunnyCdnService {
  private ipv4Set: Set<string> = new Set();
  private ipv6Set: Set<string> = new Set();
  private refreshInterval: NodeJS.Timeout | null = null;
  private config: BunnyCdnConfig | null = null;

  /**
   * Initializes the service with configuration and starts the background refresh task
   */
  public initialize(config: BunnyCdnConfig): void {
    this.config = config;

    if (!config.enabled) {
      console.log("[BunnyCDN] Integration disabled.");
      return;
    }

    console.log("[BunnyCDN] Integration enabled. Initializing...");

    // Start background refresh
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(() => {
      this.fetchBunnyIPs().catch((err) => {
        console.error("[BunnyCDN] Background refresh failed:", err);
      });
    }, config.refreshIntervalMs);

    // Ensure the interval doesn't keep the process alive
    if (this.refreshInterval.unref) {
      this.refreshInterval.unref();
    }
  }

  /**
   * Fetches the latest IP lists from Bunny CDN
   */
  public async fetchBunnyIPs(): Promise<void> {
    if (!this.config || !this.config.enabled) {
      return;
    }

    try {
      const [ipv4List, ipv6List] = await Promise.all([
        this.fetchIPList(this.config.ipv4Url),
        this.fetchIPList(this.config.ipv6Url),
      ]);

      if (ipv4List.length > 0) {
        this.ipv4Set = new Set(ipv4List);
      }

      if (ipv6List.length > 0) {
        this.ipv6Set = new Set(ipv6List);
      }

      console.log(`[BunnyCDN] Successfully loaded ${this.ipv4Set.size} IPv4 and ${this.ipv6Set.size} IPv6 edge IPs.`);
    } catch (error) {
      console.error("[BunnyCDN] Failed to fetch edge server IPs:", error);
      throw error;
    }
  }

  /**
   * Checks if an IP is a known Bunny CDN edge server
   */
  public isBunnyIp(ip: string): boolean {
    if (!this.config || !this.config.enabled) {
      return false;
    }

    return this.ipv4Set.has(ip) || this.ipv6Set.has(ip);
  }

  /**
   * Shuts down the service
   */
  public shutdown(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  private fetchIPList(url: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Failed to fetch ${url}: Status ${res.statusCode}`));
            return;
          }

          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            const ips = data
              .split("\n")
              .map((line) => line.trim())
              .filter((line) => line.length > 0);
            resolve(ips);
          });
        })
        .on("error", (err) => {
          reject(err);
        });
    });
  }
}

// Export as singleton
export const bunnyCdnService = new BunnyCdnService();
