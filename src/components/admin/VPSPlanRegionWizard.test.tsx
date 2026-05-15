import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  filterRegionsByPlanType,
  VPSPlanRegionWizard,
  type VPSPlanRegionWizardPlan,
  type VPSPlanRegionWizardRegion,
} from "@/components/admin/VPSPlanRegionWizard";

const regions: VPSPlanRegionWizardRegion[] = [
  {
    id: "us-east",
    label: "Newark",
    country: "US",
    capabilities: ["Premium Plans", "GPU Linodes", "Accelerated"],
  },
  {
    id: "us-central",
    label: "Dallas",
    country: "US",
    capabilities: [],
  },
  {
    id: "ca-central",
    label: "Toronto",
    country: "CA",
    capabilities: ["Accelerated"],
  },
];

const basePlan: VPSPlanRegionWizardPlan = {
  id: "plan-1",
  name: "KVM 4",
  type_class: "standard",
  regions: [{ region_id: "us-east" }],
};

describe("VPSPlanRegionWizard", () => {
  it("prefills selected regions from an existing plan", async () => {
    render(
      <VPSPlanRegionWizard
        open
        onOpenChange={vi.fn()}
        plan={basePlan}
        regions={regions}
        initialSelectedRegions={["us-east"]}
        onSave={vi.fn()}
      />,
    );

    expect(await screen.findByText("1 region selected")).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: "Newark" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("filters regions for premium, gpu, and accelerated plan types", () => {
    expect(
      filterRegionsByPlanType(regions, "premium").map((region) => region.id),
    ).toEqual(["us-east"]);

    expect(
      filterRegionsByPlanType(regions, "gpu").map((region) => region.id),
    ).toEqual(["us-east"]);

    expect(
      filterRegionsByPlanType(regions, "accelerated").map((region) => region.id),
    ).toEqual(["us-east", "ca-central"]);
  });

  it("blocks save flow when zero regions are selected", () => {
    render(
      <VPSPlanRegionWizard
        open
        onOpenChange={vi.fn()}
        plan={basePlan}
        regions={regions}
        initialSelectedRegions={[]}
        onSave={vi.fn()}
      />,
    );

    expect(
      (screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("returns selected region ids when saving", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <VPSPlanRegionWizard
        open
        onOpenChange={vi.fn()}
        plan={basePlan}
        regions={regions}
        initialSelectedRegions={["us-east"]}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Dallas" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Save Regions" }));

    expect(onSave).toHaveBeenCalledWith(["us-east", "us-central"]);
  });
});
