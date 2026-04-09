import { beforeEach, describe, expect, it, vi } from "vitest";

const mockListIPv6Ranges = vi.fn();
const mockGetIPv6Range = vi.fn();

vi.mock("../../api/services/linodeService.js", async () => {
  const actual = await vi.importActual<typeof import("../../api/services/linodeService.js")>(
    "../../api/services/linodeService.js"
  );

  return {
    ...actual,
    linodeService: {
      ...actual.linodeService,
      listIPv6Ranges: (...args: any[]) => mockListIPv6Ranges(...args),
      getIPv6Range: (...args: any[]) => mockGetIPv6Range(...args),
    },
  };
});

import { LinodeProviderService } from "../../api/services/providers/LinodeProviderService.js";

describe("LinodeProviderService IPv6 range normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("populates instanceIds and primary instanceId from range detail", async () => {
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
      linodes: [95646725, 95646726],
    });

    const service = new LinodeProviderService("test-token");
    const ranges = await service.listIPv6Ranges();

    expect(ranges).toHaveLength(1);
    expect(ranges[0].instanceIds).toEqual(["95646725", "95646726"]);
    expect(ranges[0].instanceId).toBe("95646725");
    expect(ranges[0].routeTarget).toBe("2600:3c04::1");
  });
});
