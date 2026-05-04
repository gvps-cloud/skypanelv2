import { describe, expect, it } from "vitest";

import { getHostingFeatureSpecRows } from "@/lib/hostingPlanFeatures";
import type { HostingPlan } from "@/hooks/useHosting";

const buildPlan = (resources: Record<string, { total?: number | null }>): HostingPlan => ({
  id: "plan-1",
  name: "Test Plan",
  service_type: "web",
  price_monthly: 4.99,
  features: { resources },
});

describe("hostingPlanFeatures", () => {
  it("keeps zero values as zero by default", () => {
    const rows = getHostingFeatureSpecRows(
      buildPlan({
        websites: { total: 0 },
        diskspace: { total: 0 },
      }),
      9,
    );

    expect(rows.find((row) => row.key === "websites")?.label).toBe("0 Websites");
    expect(rows.find((row) => row.key === "diskspace")?.label).toBe("0 MB Disk space");
  });

  it("can render zero values as unlimited with override mode", () => {
    const rows = getHostingFeatureSpecRows(
      buildPlan({
        websites: { total: 0 },
        diskspace: { total: 0 },
      }),
      9,
      { zeroMeansUnlimited: true },
    );

    expect(rows.find((row) => row.key === "websites")?.label).toBe("Unlimited Websites");
    expect(rows.find((row) => row.key === "diskspace")?.label).toBe("Unlimited Disk space");
  });

  it("renders null, undefined, and -1 as unlimited", () => {
    const rows = getHostingFeatureSpecRows(
      buildPlan({
        websites: { total: null },
        ftpUsers: {},
        mysqlDbs: { total: -1 },
      }),
      9,
    );

    expect(rows.find((row) => row.key === "websites")?.label).toBe("Unlimited Websites");
    expect(rows.find((row) => row.key === "ftpUsers")?.label).toBe("Unlimited FTP users");
    expect(rows.find((row) => row.key === "mysqlDbs")?.label).toBe("Unlimited MySQL databases");
  });
});
