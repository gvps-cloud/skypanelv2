import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OrganizationResourceTables } from "@/components/organizations/OrganizationResourceTables";
import type { OrganizationResources } from "@/types/organizations";

const createResources = (): OrganizationResources => ({
  organization_id: "org-1",
  organization_name: "Example Org",
  vps_instances: Array.from({ length: 6 }, (_, index) => ({
    id: `vps-${index + 1}`,
    label: `server-${index + 1}`,
    status: index % 2 === 0 ? "running" : "stopped",
    configuration: { type: "shared-cpu", region: "us-east" },
    plan_name: "Starter",
    ip_address: `10.0.0.${index + 1}`,
    created_at: `2026-03-0${(index % 9) + 1}T10:00:00.000Z`,
  })),
  ssh_keys: [
    {
      id: "ssh-1",
      name: "deploy key",
      fingerprint: "SHA256:abc123",
      linode_key_id: "linode-1",
      created_at: "2026-03-01T10:00:00.000Z",
      updated_at: "2026-03-01T10:00:00.000Z",
    },
  ],
  tickets: [
    {
      id: "ticket-1",
      subject: "billing issue",
      status: "open",
      priority: "medium",
      created_at: "2026-03-01T10:00:00.000Z",
      updated_at: "2026-03-02T11:00:00.000Z",
    },
  ],
  permissions: {
    vps_view: true,
    vps_create: true,
    vps_delete: false,
    vps_manage: false,
    ssh_keys_view: true,
    ssh_keys_manage: false,
    tickets_view: true,
    tickets_create: true,
    tickets_manage: false,
    billing_view: false,
    billing_manage: false,
    members_manage: false,
    settings_manage: false,
  },
});

const renderComponent = () => {
  const props = {
    organizationId: "org-1",
    isActiveOrganization: true,
    resources: createResources(),
    formatTimestamp: (timestamp: string | undefined) => timestamp ?? "—",
    getProviderSyncedLabel: () => "Provider synced",
    getStatusBadgeVariant: (status: string) =>
      status === "running" || status === "open" ? "default" : "secondary",
    onCreateVps: vi.fn(),
    onOpenSshKeys: vi.fn(),
    onCreateTicket: vi.fn(),
    onOpenVps: vi.fn(),
    onOpenTicket: vi.fn(),
  };

  render(<OrganizationResourceTables {...props} />);

  return props;
};

describe("OrganizationResourceTables", () => {
  it("renders paginated VPS rows in a table", () => {
    renderComponent();

    expect(screen.getByText("server-1")).toBeTruthy();
    expect(screen.queryByText("server-6")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "2" }));

    expect(screen.getByText("server-6")).toBeTruthy();
    expect(screen.queryByText("server-1")).toBeNull();
  });

  it("switches tabs and opens the selected organization resource", async () => {
    const props = renderComponent();

    const sshKeysTab = screen.getByRole("tab", { name: /SSH Keys/i });
    fireEvent.mouseDown(sshKeysTab);
    fireEvent.click(await screen.findByText("deploy key"));
    expect(props.onOpenSshKeys).toHaveBeenCalledWith("ssh-1");

    const supportTicketsTab = screen.getByRole("tab", { name: /Support Tickets/i });
    fireEvent.mouseDown(supportTicketsTab);
    fireEvent.click(await screen.findByText("billing issue"));
    expect(props.onOpenTicket).toHaveBeenCalledWith("ticket-1");
  });
});