import { describe, expect, it } from "vitest";

import { getActiveSteps } from "@/lib/vpsStepConfiguration";

describe("vpsStepConfiguration", () => {
  it("includes dedicated picker stages before deployment and OS steps", () => {
    const steps = getActiveSteps({
      providerType: "linode",
      formData: {
        provider_id: "provider-1",
        provider_type: "linode",
        label: "vps-test",
        type_class: "standard",
        region: "us-east",
        type: "plan-1",
        image: "linode/ubuntu22.04",
      },
      hasDeploymentConfig: false,
    });

    expect(steps.map((step) => step.id)).toEqual([
      "plan-label",
      "region",
      "plan",
      "deployments",
      "os",
      "finalize",
    ]);

    expect(steps.map((step) => step.stepNumber)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("keeps deployment configuration in sequence when required", () => {
    const steps = getActiveSteps({
      providerType: "linode",
      formData: {
        provider_id: "provider-1",
        provider_type: "linode",
        label: "vps-test",
        type_class: "standard",
        region: "us-east",
        type: "plan-1",
        image: "linode/ubuntu22.04",
      },
      hasDeploymentConfig: true,
    });

    expect(steps.map((step) => step.id)).toEqual([
      "plan-label",
      "region",
      "plan",
      "deployments",
      "deployment-config",
      "os",
      "finalize",
    ]);

    expect(steps.map((step) => step.stepNumber)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
