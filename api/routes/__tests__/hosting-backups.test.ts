import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import backupsRouter from "../hosting/backups.js";

const mockGetHostingSubscriptionForOrganization = vi.hoisted(() => vi.fn());
const mockGetEnhanceWebsiteOrgId = vi.hoisted(() => vi.fn());
const mockGetWebsiteBackups = vi.hoisted(() => vi.fn());
const mockGetWebsiteBackup = vi.hoisted(() => vi.fn());
const mockRestoreWebsiteBackup = vi.hoisted(() => vi.fn());
const mockDeleteWebsiteBackup = vi.hoisted(() => vi.fn());
const mockGetWebsiteBackupStatus = vi.hoisted(() => vi.fn());
const mockGetWebsiteRestoreStatus = vi.hoisted(() => vi.fn());
const mockGetWebsiteBackupDirectoryTree = vi.hoisted(() => vi.fn());
const mockDownloadWebsiteBackup = vi.hoisted(() => vi.fn());
const mockUploadWebsiteBackup = vi.hoisted(() => vi.fn());
const mockGetBackupsDisabled = vi.hoisted(() => vi.fn());
const mockSetBackupsDisabled = vi.hoisted(() => vi.fn());

vi.mock("../../middleware/auth.js", () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { organizationId: "org-123" };
    next();
  },
  requireOrganization: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/hosting.js", () => ({
  requireHostingEnabledForUsers: (_req: any, _res: any, next: any) => next(),
  requireOrgPermission: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../lib/hostingEnhanceOrg.js", () => ({
  getHostingSubscriptionForOrganization: (...args: any[]) => mockGetHostingSubscriptionForOrganization(...args),
  getEnhanceWebsiteOrgId: (...args: any[]) => mockGetEnhanceWebsiteOrgId(...args),
}));

vi.mock("../../services/enhanceService.js", () => ({
  EnhanceApiError: class EnhanceApiError extends Error {
    constructor(
      message: string,
      public statusCode?: number,
      public responseBody?: any,
    ) {
      super(message);
    }
  },
  EnhanceService: {
    getWebsiteBackups: (...args: any[]) => mockGetWebsiteBackups(...args),
    getWebsiteBackup: (...args: any[]) => mockGetWebsiteBackup(...args),
    restoreWebsiteBackup: (...args: any[]) => mockRestoreWebsiteBackup(...args),
    deleteWebsiteBackup: (...args: any[]) => mockDeleteWebsiteBackup(...args),
    getWebsiteBackupStatus: (...args: any[]) => mockGetWebsiteBackupStatus(...args),
    getWebsiteRestoreStatus: (...args: any[]) => mockGetWebsiteRestoreStatus(...args),
    getWebsiteBackupDirectoryTree: (...args: any[]) => mockGetWebsiteBackupDirectoryTree(...args),
    downloadWebsiteBackup: (...args: any[]) => mockDownloadWebsiteBackup(...args),
    uploadWebsiteBackup: (...args: any[]) => mockUploadWebsiteBackup(...args),
    getBackupsDisabled: (...args: any[]) => mockGetBackupsDisabled(...args),
    setBackupsDisabled: (...args: any[]) => mockSetBackupsDisabled(...args),
  },
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/hosting/backups", backupsRouter);
  return app;
}

describe("Hosting backup routes", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetHostingSubscriptionForOrganization.mockResolvedValue({
      id: "sub-123",
      enhance_website_id: "web-123",
      enhance_customer_org_id: "cust-org-123",
    });
    mockGetEnhanceWebsiteOrgId.mockReturnValue("cust-org-123");
    mockGetBackupsDisabled.mockResolvedValue(false);
    mockSetBackupsDisabled.mockResolvedValue(undefined);
  });

  it("normalizes Enhance backup metadata for the list response", async () => {
    mockGetWebsiteBackups.mockResolvedValue({
      items: [
        {
          id: 42,
          startedAt: "2026-05-02T10:00:00Z",
          finishedAt: "2026-05-02T10:05:00Z",
          homeDirStatus: "successful",
          mysqlDbsStatus: "failed",
          emailsStatus: "successful",
          size: "10000",
          filesSize: "1048576",
          mysqlDbsSize: "524288",
          emailsSize: "262144",
          kind: "manual",
          storageKind: "enhance",
        },
      ],
    });

    const response = await request(app).get("/api/hosting/backups/sub-123/backups").expect(200);

    expect(response.body.backups[0]).toMatchObject({
      id: "42",
      displayDate: "2026-05-02T10:00:00Z",
      displayStatus: "partial",
      canRestore: true,
      components: {
        files: { status: "successful", size: 1048576 },
        databases: { status: "failed", size: 524288 },
        emails: { status: "successful", size: 262144 },
      },
    });
    expect(mockGetWebsiteBackups).toHaveBeenCalledWith("cust-org-123", "web-123");
  });

  it("forwards restore options and storageKind to Enhance", async () => {
    mockRestoreWebsiteBackup.mockResolvedValue({ success: true });

    await request(app)
      .put("/api/hosting/backups/sub-123/backups/42?storageKind=s3")
      .send({ includeEmails: true, restoreFiles: false, restoreDatabases: [] })
      .expect(200);

    expect(mockRestoreWebsiteBackup).toHaveBeenCalledWith("cust-org-123", "web-123", "42", {
      includeEmails: true,
      restoreFiles: false,
      restoreDatabases: [],
      storageKind: "s3",
    });
  });

  it("rejects invalid storageKind values", async () => {
    await request(app).get("/api/hosting/backups/sub-123/backups/42?storageKind=local").expect(400);

    expect(mockGetWebsiteBackup).not.toHaveBeenCalled();
  });

  it("proxies backup directory tree and restore status", async () => {
    mockGetWebsiteRestoreStatus.mockResolvedValue({
      backupId: 42,
      startedAt: "2026-05-02T11:00:00Z",
      homeDirStatus: "successful",
    });
    mockGetWebsiteBackupDirectoryTree.mockResolvedValue([
      {
        name: "public_html",
        rel_path: "public_html",
        node_type: "directory",
        size: 0,
        permissions: "0755",
        last_modified: "2026-05-02T10:00:00Z",
      },
    ]);

    const restoreResponse = await request(app)
      .get("/api/hosting/backups/sub-123/backups/42/restore-status")
      .expect(200);
    const treeResponse = await request(app)
      .get("/api/hosting/backups/sub-123/backups/42/directory-tree?offset=public_html")
      .expect(200);

    expect(restoreResponse.body.status.displayStatus).toBe("successful");
    expect(treeResponse.body.nodes).toHaveLength(1);
    expect(mockGetWebsiteBackupDirectoryTree).toHaveBeenCalledWith("cust-org-123", "web-123", "42", "public_html");
  });

  it("proxies backup archive download and upload", async () => {
    const archive = Buffer.from([31, 139, 8]);
    mockDownloadWebsiteBackup.mockResolvedValue({
      data: archive,
      contentType: "application/gzip",
      contentDisposition: 'attachment; filename="email.tar.gz"',
    });
    mockUploadWebsiteBackup.mockResolvedValue({ data: Buffer.alloc(0), contentType: "application/gzip" });

    const downloadResponse = await request(app)
      .get("/api/hosting/backups/sub-123/backup/download?backupDownloadKind=email")
      .expect(200);

    await request(app)
      .post("/api/hosting/backups/sub-123/backup/upload")
      .set("Content-Type", "application/gzip")
      .send(archive)
      .expect(200);

    expect(downloadResponse.headers["content-type"]).toContain("application/gzip");
    expect(Buffer.from(downloadResponse.body)).toEqual(archive);
    expect(mockDownloadWebsiteBackup).toHaveBeenCalledWith("web-123", "email");
    expect(mockUploadWebsiteBackup).toHaveBeenCalledWith("web-123", archive);
  });
});
