import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";

import { OrganizationManagement } from "./OrganizationManagement";
import { renderWithAuth } from "@/test-utils";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const buildRoles = (suffix = "") => [
  {
    id: `role-owner${suffix}`,
    name: "owner",
    permissions: [],
    isCustom: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: `role-admin${suffix}`,
    name: "admin",
    permissions: [],
    isCustom: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: `role-vps${suffix}`,
    name: "vps_manager",
    permissions: [],
    isCustom: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: `role-support${suffix}`,
    name: "support_agent",
    permissions: [],
    isCustom: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: `role-viewer${suffix}`,
    name: "viewer",
    permissions: [],
    isCustom: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("OrganizationManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("auth_token", "test-token");
    localStorage.setItem(
      "auth_user",
      JSON.stringify({ id: "admin-1", role: "admin" }),
    );
  });

  it("loads organizations, creates a new one, and adds a member", async () => {
    const organizations: Array<Record<string, any>> = [
      {
        id: "org-1",
        name: "Acme Cloud",
        slug: "acme-cloud",
        ownerId: "user-1",
        ownerName: "Alice Owner",
        ownerEmail: "alice@example.com",
        memberCount: 1,
        roles: buildRoles("-org-1"),
        members: [
          {
            userId: "user-1",
            userName: "Alice Owner",
            userEmail: "alice@example.com",
            role: "owner",
            roleId: "role-owner-org-1",
            roleName: "owner",
            userRole: "admin",
            joinedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    vi.mocked(global.fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.endsWith("/api/admin/organizations") && method === "GET") {
        return jsonResponse({ organizations });
      }

      if (
        url.includes("/api/admin/users/search") &&
        url.includes("Alice") &&
        method === "GET"
      ) {
        return jsonResponse({
          users: [
            {
              id: "user-1",
              name: "Alice Owner",
              email: "alice@example.com",
              role: "admin",
              created_at: "2026-01-01T00:00:00.000Z",
              isAlreadyMember: false,
              organizations: [],
            },
          ],
        });
      }

      if (url.endsWith("/api/admin/organizations") && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}"));
        expect(body).toMatchObject({
          name: "Beta Hosting",
          slug: "beta-hosting",
          ownerId: "user-1",
        });
        expect(body).not.toHaveProperty("description");

        organizations.unshift({
          id: "org-2",
          name: "Beta Hosting",
          slug: "beta-hosting",
          owner_id: "user-1",
          owner_name: "Alice Owner",
          owner_email: "alice@example.com",
          member_count: 1,
          roles: buildRoles("-org-2"),
          members: [
            {
              userId: "user-1",
              userName: "Alice Owner",
              userEmail: "alice@example.com",
              role: "owner",
              roleId: "role-owner-org-2",
              roleName: "owner",
              userRole: "admin",
              joinedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          created_at: "2026-01-02T00:00:00.000Z",
          updated_at: "2026-01-02T00:00:00.000Z",
        } as any);

        return jsonResponse({ organization: organizations[0] }, 201);
      }

      if (
        url.includes("/api/admin/users/search") &&
        url.includes("organizationId=org-2") &&
        url.includes("Bob") &&
        method === "GET"
      ) {
        return jsonResponse({
          users: [
            {
              id: "user-2",
              name: "Bob Member",
              email: "bob@example.com",
              role: "user",
              created_at: "2026-01-01T00:00:00.000Z",
              isAlreadyMember: false,
              organizations: [],
            },
          ],
        });
      }

      if (
        url.endsWith("/api/admin/organizations/org-2/members") &&
        method === "POST"
      ) {
        const body = JSON.parse(String(init?.body ?? "{}"));
        expect(body).toEqual({ userId: "user-2", roleId: "role-viewer-org-2" });

        organizations[0] = {
          ...organizations[0],
          memberCount: 2,
          member_count: 2,
          members: [
            ...(organizations[0].members ?? []),
            {
              userId: "user-2",
              userName: "Bob Member",
              userEmail: "bob@example.com",
              role: "viewer",
              roleId: "role-viewer-org-2",
              roleName: "viewer",
              userRole: "user",
              joinedAt: "2026-01-03T00:00:00.000Z",
            },
          ],
        };

        return jsonResponse(
          {
            member: {
              userId: "user-2",
              userName: "Bob Member",
              userEmail: "bob@example.com",
              role: "viewer",
              roleId: "role-viewer-org-2",
              roleName: "viewer",
              userRole: "user",
              joinedAt: "2026-01-03T00:00:00.000Z",
            },
          },
          201,
        );
      }

      throw new Error(`Unhandled request: ${method} ${url}`);
    });

    renderWithAuth(<OrganizationManagement />);

    expect(await screen.findByText("Acme Cloud")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /create organization/i }));
    fireEvent.change(screen.getByLabelText(/^Name$/i), {
      target: { value: "Beta Hosting" },
    });
    fireEvent.change(screen.getByLabelText(/^Slug$/i), {
      target: { value: "beta-hosting" },
    });
    expect(screen.queryByLabelText(/Description/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Search for owner/i), {
      target: { value: "Alice" },
    });
    fireEvent.click(screen.getByRole("button", { name: /search owners/i }));

    fireEvent.click(await screen.findByRole("button", { name: /Alice Owner/i }));
    fireEvent.click(screen.getByRole("button", { name: /create organization$/i }));

    expect(await screen.findByText("Beta Hosting")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Add member for Beta Hosting/i }),
    );
    fireEvent.change(screen.getByLabelText(/Search users/i), {
      target: { value: "Bob" },
    });
    fireEvent.click(screen.getByRole("button", { name: /search members/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Bob Member/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Add member$/i }));

    await waitFor(() => {
      expect(screen.getByText("Bob Member")).toBeInTheDocument();
    });
  });

  it("removes the description field from create and edit modes and hides move actions", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      jsonResponse({
        organizations: [
          {
            id: "org-1",
            name: "Acme Cloud",
            slug: "acme-cloud",
            ownerId: "user-1",
            ownerName: "Alice Owner",
            ownerEmail: "alice@example.com",
            description: "Existing description",
            memberCount: 1,
            roles: buildRoles("-org-1"),
            members: [
              {
                userId: "user-1",
                userName: "Alice Owner",
                userEmail: "alice@example.com",
                role: "owner",
                roleId: "role-owner-org-1",
                roleName: "owner",
                userRole: "admin",
                joinedAt: "2026-01-01T00:00:00.000Z",
              },
            ],
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );

    renderWithAuth(<OrganizationManagement />);

    fireEvent.click(await screen.findByRole("button", { name: /Acme Cloud/i }));
    expect(
      screen.queryByRole("button", { name: /^Move Alice Owner from Acme Cloud$/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Edit Acme Cloud/i }));

    expect(screen.queryByLabelText(/Description/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Update the organization name and slug/i)).toBeInTheDocument();
  });
});