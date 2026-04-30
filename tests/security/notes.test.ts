import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mockQuery = vi.fn();
const mockClientQuery = vi.fn();
const mockTransaction = vi.fn();

vi.mock("../../api/middleware/auth.js", () => ({
  authenticateToken: (
    _req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => next(),
}));

vi.mock("../../api/lib/database.js", () => ({
  query: (...args: any[]) => mockQuery(...args),
  transaction: (...args: any[]) => mockTransaction(...args),
}));

vi.mock("../../api/services/activityLogger.js", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

import notesRoutes from "../../api/routes/notes.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: "00000000-0000-0000-0000-000000000001",
      role: "user",
      organizationId: "11111111-1111-1111-1111-111111111111",
    };
    next();
  });
  app.use("/api", notesRoutes);
  return app;
}

describe("notes routes security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (callback: any) =>
      callback({ query: mockClientQuery }),
    );
  });

  it("rejects personal note creation when organization scope is injected", async () => {
    const response = await request(createApp())
      .post("/api/notes/personal")
      .send({
        title: "Injected scope",
        content: "Should fail",
        organizationId: "11111111-1111-1111-1111-111111111111",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/organization context/i);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("allows organization note reads for members and preserves raw text content", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            organization_id: "11111111-1111-1111-1111-111111111111",
            organization_name: "Example Org",
            legacy_role: "member",
            role_name: "viewer",
            permissions: JSON.stringify(["notes_view"]),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "22222222-2222-2222-2222-222222222222",
            scope: "organization",
            organization_id: "11111111-1111-1111-1111-111111111111",
            organization_name: "Example Org",
            owner_user_id: null,
            title: "Ops",
            content: "<script>alert('xss')</script>",
            created_at: "2026-04-10T12:00:00.000Z",
            updated_at: "2026-04-10T12:00:00.000Z",
            created_by_id: "00000000-0000-0000-0000-000000000001",
            created_by_name: "Test User",
            created_by_email: "test@example.com",
            updated_by_id: "00000000-0000-0000-0000-000000000001",
            updated_by_name: "Test User",
            updated_by_email: "test@example.com",
          },
        ],
      });

    const response = await request(createApp()).get(
      "/api/organizations/11111111-1111-1111-1111-111111111111/notes",
    );

    expect(response.status).toBe(200);
    expect(response.body.notes).toHaveLength(1);
    expect(response.body.notes[0].content).toBe("<script>alert('xss')</script>");
  });

  it("rejects organization note reads for non-members", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const response = await request(createApp()).get(
      "/api/organizations/11111111-1111-1111-1111-111111111111/notes",
    );

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/not a member/i);
  });

  it("rejects organization note writes without notes_manage permission", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          organization_id: "11111111-1111-1111-1111-111111111111",
          organization_name: "Example Org",
          legacy_role: "member",
          role_name: "viewer",
          permissions: JSON.stringify(["notes_view"]),
        },
      ],
    });

    const response = await request(createApp())
      .post("/api/organizations/11111111-1111-1111-1111-111111111111/notes")
      .send({
        title: "Shared note",
        content: "Read only members cannot create this",
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/insufficient permissions/i);
    expect(mockClientQuery).not.toHaveBeenCalled();
  });

  it("rejects organization note writes when the body org does not match the path org", async () => {
    const response = await request(createApp())
      .post("/api/organizations/11111111-1111-1111-1111-111111111111/notes")
      .send({
        organizationId: "33333333-3333-3333-3333-333333333333",
        title: "Mismatch",
        content: "Should fail",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/scope mismatch/i);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
