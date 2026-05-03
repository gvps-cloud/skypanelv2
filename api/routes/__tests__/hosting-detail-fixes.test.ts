import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import appsRouter from "../hosting/apps.js";
import emailRouter from "../hosting/email.js";
import webRouter from "../hosting/web.js";
import wordpressRouter from "../hosting/wordpress.js";
import joomlaRouter from "../hosting/joomla.js";

const mockGetHostingSubscriptionForOrganization = vi.hoisted(() => vi.fn());
const mockGetEnhanceWebsiteOrgId = vi.hoisted(() => vi.fn());
const mockGetWebsiteApps = vi.hoisted(() => vi.fn());
const mockGetWordpressAppVersion = vi.hoisted(() => vi.fn());
const mockGetWebsiteDomainMappings = vi.hoisted(() => vi.fn());
const mockGetWebsiteServerDomains = vi.hoisted(() => vi.fn());
const mockGetStagingDomain = vi.hoisted(() => vi.fn());
const mockCreateWebsiteEmail = vi.hoisted(() => vi.fn());
const mockGetWordpressUsers = vi.hoisted(() => vi.fn());
const mockGetWordpressPlugins = vi.hoisted(() => vi.fn());
const mockGetWordpressThemes = vi.hoisted(() => vi.fn());
const mockUpdateWordpressSettings = vi.hoisted(() => vi.fn());
const mockGetWordpressMaintenanceMode = vi.hoisted(() => vi.fn());
const mockSetWordpressMaintenanceMode = vi.hoisted(() => vi.fn());
const mockGetWordpressConfig = vi.hoisted(() => vi.fn());
const mockSetWordpressConfig = vi.hoisted(() => vi.fn());
const mockUpdateWordpressPluginSettings = vi.hoisted(() => vi.fn());
const mockSetWordpressThemeAutoUpdateStatus = vi.hoisted(() => vi.fn());
const mockCreateWordpressUser = vi.hoisted(() => vi.fn());
const mockUpdateWordpressUser = vi.hoisted(() => vi.fn());
const mockGetJoomlaInfo = vi.hoisted(() => vi.fn());
const mockGetJoomlaUsers = vi.hoisted(() => vi.fn());
const mockCreateJoomlaUser = vi.hoisted(() => vi.fn());
const mockDeleteJoomlaUser = vi.hoisted(() => vi.fn());
const mockResetJoomlaUserPassword = vi.hoisted(() => vi.fn());
const mockUpdateJoomlaUsername = vi.hoisted(() => vi.fn());
const mockUpdateJoomlaEmailAddress = vi.hoisted(() => vi.fn());
const mockGetWebsite = vi.hoisted(() => vi.fn());
const mockUpdateWebsite = vi.hoisted(() => vi.fn());
const mockGetSiteAccessToken = vi.hoisted(() => vi.fn());

vi.mock("../../config/index.js", () => ({
  config: {
    ENHANCE_API_URL: "https://panel.example.com",
    ENHANCE_MASTER_ORG_ID: "master-org",
    NODE_ENV: "test",
  },
}));

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
    getWebsiteApps: (...args: any[]) => mockGetWebsiteApps(...args),
    getWordpressAppVersion: (...args: any[]) => mockGetWordpressAppVersion(...args),
    getWebsiteDomainMappings: (...args: any[]) => mockGetWebsiteDomainMappings(...args),
    getWebsiteServerDomains: (...args: any[]) => mockGetWebsiteServerDomains(...args),
    getStagingDomain: (...args: any[]) => mockGetStagingDomain(...args),
    createWebsiteEmail: (...args: any[]) => mockCreateWebsiteEmail(...args),
    getWordpressUsers: (...args: any[]) => mockGetWordpressUsers(...args),
    getWordpressPlugins: (...args: any[]) => mockGetWordpressPlugins(...args),
    getWordpressThemes: (...args: any[]) => mockGetWordpressThemes(...args),
    updateWordpressSettings: (...args: any[]) => mockUpdateWordpressSettings(...args),
    getWordpressMaintenanceMode: (...args: any[]) => mockGetWordpressMaintenanceMode(...args),
    setWordpressMaintenanceMode: (...args: any[]) => mockSetWordpressMaintenanceMode(...args),
    getWordpressConfig: (...args: any[]) => mockGetWordpressConfig(...args),
    setWordpressConfig: (...args: any[]) => mockSetWordpressConfig(...args),
    updateWordpressPluginSettings: (...args: any[]) => mockUpdateWordpressPluginSettings(...args),
    setWordpressThemeAutoUpdateStatus: (...args: any[]) => mockSetWordpressThemeAutoUpdateStatus(...args),
    createWordpressUser: (...args: any[]) => mockCreateWordpressUser(...args),
    updateWordpressUser: (...args: any[]) => mockUpdateWordpressUser(...args),
    getJoomlaInfo: (...args: any[]) => mockGetJoomlaInfo(...args),
    getJoomlaUsers: (...args: any[]) => mockGetJoomlaUsers(...args),
    createJoomlaUser: (...args: any[]) => mockCreateJoomlaUser(...args),
    deleteJoomlaUser: (...args: any[]) => mockDeleteJoomlaUser(...args),
    resetJoomlaUserPassword: (...args: any[]) => mockResetJoomlaUserPassword(...args),
    updateJoomlaUsername: (...args: any[]) => mockUpdateJoomlaUsername(...args),
    updateJoomlaEmailAddress: (...args: any[]) => mockUpdateJoomlaEmailAddress(...args),
    getWebsite: (...args: any[]) => mockGetWebsite(...args),
    updateWebsite: (...args: any[]) => mockUpdateWebsite(...args),
    getSiteAccessToken: (...args: any[]) => mockGetSiteAccessToken(...args),
  },
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/apps", appsRouter);
  app.use("/email", emailRouter);
  app.use("/web", webRouter);
  app.use("/wordpress", wordpressRouter);
  app.use("/joomla", joomlaRouter);
  return app;
}

describe("hosting detail route fixes", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetHostingSubscriptionForOrganization.mockResolvedValue({
      id: "sub-123",
      enhance_website_id: "web-123",
      enhance_subscription_id: "enhance-sub-123",
      enhance_customer_org_id: "cust-org-123",
    });
    mockGetEnhanceWebsiteOrgId.mockReturnValue("cust-org-123");
    mockGetWebsiteServerDomains.mockResolvedValue({ stagingDomains: ["preview.example.com"] });
    mockGetStagingDomain.mockResolvedValue("enhance-preview.test");
    mockGetWordpressMaintenanceMode.mockResolvedValue("deactivated");
    mockSetWordpressMaintenanceMode.mockResolvedValue(undefined);
    mockGetWordpressConfig.mockResolvedValue({});
    mockSetWordpressConfig.mockResolvedValue(undefined);
    mockUpdateWebsite.mockResolvedValue(undefined);
  });

  it("normalizes Enhance disabled website status for the hosting status card", async () => {
    mockGetWebsite.mockResolvedValue({
      id: "web-123",
      status: "disabled",
      suspendedBy: "admin-user",
    });

    const response = await request(app).get("/web/sub-123/website").expect(200);

    expect(response.body).toMatchObject({
      id: "web-123",
      status: "disabled",
      isSuspended: true,
      normalizedStatus: "suspended",
    });
    expect(mockGetWebsite).toHaveBeenCalledWith("cust-org-123", "web-123");
  });

  it("updates website suspension with Enhance status values and returns a fresh website read", async () => {
    mockGetWebsite.mockResolvedValue({
      id: "web-123",
      status: "disabled",
      suspendedBy: "admin-user",
    });

    const response = await request(app)
      .patch("/web/sub-123/website")
      .send({ isSuspended: true })
      .expect(200);

    expect(mockUpdateWebsite).toHaveBeenCalledWith("cust-org-123", "web-123", {
      isSuspended: true,
      status: "disabled",
    });
    expect(mockGetWebsite).toHaveBeenCalledWith("cust-org-123", "web-123");
    expect(response.body).toMatchObject({
      id: "web-123",
      status: "disabled",
      isSuspended: true,
      normalizedStatus: "suspended",
    });
  });

  it("enriches placeholder WordPress app versions from the runtime version endpoint", async () => {
    mockGetWebsiteApps.mockResolvedValue({
      items: [
        { id: "wp-app", app: "wordpress", version: "0.0.0", path: "public_html" },
        { id: "node-app", app: "node", version: "20.0.0" },
      ],
    });
    mockGetWordpressAppVersion.mockResolvedValue({ version: "6.5.4" });

    const response = await request(app).get("/apps/sub-123/apps").expect(200);

    expect(response.body.apps).toEqual([
      { id: "wp-app", app: "wordpress", version: "6.5.4", path: "public_html" },
      { id: "node-app", app: "node", version: "20.0.0" },
    ]);
    expect(mockGetWordpressAppVersion).toHaveBeenCalledWith("cust-org-123", "web-123", "wp-app");
  });

  it("lists Joomla installations from installed website apps", async () => {
    mockGetWebsiteApps.mockResolvedValue({
      items: [
        { id: "joomla-app", app: "joomla", version: "5.1.0", path: "cms", status: "active" },
        { id: "wp-app", app: "wordpress", version: "6.5.4" },
      ],
    });

    const response = await request(app).get("/joomla/sub-123/joomla").expect(200);

    expect(response.body.installations).toEqual([
      { id: "joomla-app", name: "Joomla (cms)", path: "cms", version: "5.1.0", status: "active" },
    ]);
    expect(mockGetWebsiteApps).toHaveBeenCalledWith("cust-org-123", "web-123");
  });

  it("normalizes Joomla info and users from documented Enhance responses", async () => {
    mockGetJoomlaInfo.mockResolvedValue({ version: "5.1.0", site_url: "https://site.example", plugin_count: 12, user_count: 1 });
    mockGetJoomlaUsers.mockResolvedValue({
      items: [{ id: 1, username: "admin", name: "Admin User", email: "admin@example.com", blocked: false, super_user: true }],
    });

    const infoResponse = await request(app).get("/joomla/sub-123/joomla/joomla-app/info").expect(200);
    const usersResponse = await request(app).get("/joomla/sub-123/joomla/joomla-app/users").expect(200);

    expect(infoResponse.body.info).toEqual({ version: "5.1.0", siteUrl: "https://site.example", pluginCount: 12, userCount: 1 });
    expect(usersResponse.body.users).toEqual([
      { id: "1", username: "admin", name: "Admin User", email: "admin@example.com", blocked: false, superUser: true },
    ]);
  });

  it("forwards Joomla user create, update, and delete to documented endpoints", async () => {
    mockCreateJoomlaUser.mockResolvedValue(undefined);
    mockUpdateJoomlaEmailAddress.mockResolvedValue(undefined);
    mockResetJoomlaUserPassword.mockResolvedValue(undefined);
    mockUpdateJoomlaUsername.mockResolvedValue(undefined);
    mockDeleteJoomlaUser.mockResolvedValue(undefined);

    await request(app)
      .post("/joomla/sub-123/joomla/joomla-app/users")
      .send({ username: "admin", email: "admin@example.com", password: "Password123!", ignored: "field" })
      .expect(200);

    await request(app)
      .patch("/joomla/sub-123/joomla/joomla-app/users/admin")
      .send({ username: "site-admin", email: "site-admin@example.com", password: "NewPassword123!" })
      .expect(200);

    await request(app).delete("/joomla/sub-123/joomla/joomla-app/users/site-admin").expect(200);

    expect(mockCreateJoomlaUser).toHaveBeenCalledWith("cust-org-123", "web-123", "joomla-app", {
      username: "admin",
      email: "admin@example.com",
      password: "Password123!",
    });
    expect(mockUpdateJoomlaEmailAddress).toHaveBeenCalledWith("cust-org-123", "web-123", "joomla-app", "admin", "site-admin@example.com");
    expect(mockResetJoomlaUserPassword).toHaveBeenCalledWith("cust-org-123", "web-123", "joomla-app", "admin", "NewPassword123!");
    expect(mockUpdateJoomlaUsername).toHaveBeenCalledWith("cust-org-123", "web-123", "joomla-app", "admin", "site-admin");
    expect(mockDeleteJoomlaUser).toHaveBeenCalledWith("cust-org-123", "web-123", "joomla-app", "site-admin");
  });

  it("filters preview domains and rejects hidden preview-domain email submissions", async () => {
    mockGetWebsiteDomainMappings.mockResolvedValue({
      items: [
        { id: "real-domain", domain: "customer.example" },
        { id: "preview-domain", domain: "site.preview.example.com" },
        { id: "staging-kind", domain: "hidden.example", mappingKind: "staging" },
      ],
    });

    const listResponse = await request(app).get("/email/sub-123/domains").expect(200);
    expect(listResponse.body.domains).toEqual([
      expect.objectContaining({ id: "real-domain", domain: "customer.example", emailEligible: true }),
    ]);
    expect(listResponse.body.excludedCount).toBe(2);

    await request(app)
      .post("/email/sub-123/emails")
      .send({ username: "test", domainId: "preview-domain", mailboxPassword: "Password123!" })
      .expect(400);
    expect(mockCreateWebsiteEmail).not.toHaveBeenCalled();
  });

  it("omits unsupported WordPress user roles from users responses", async () => {
    mockGetWordpressUsers.mockResolvedValue({
      items: [
        { id: 7, login: "admin", email: "admin@example.com", roles: ["administrator"] },
        { id: 8, login: "editor", email: "editor@example.com", role: { value: "editor" } },
        { id: 9, login: "author", email: "author@example.com", meta: { wp_capabilities: 'a:1:{s:6:"author";b:1;}' } },
        { id: 10, login: "subscriber", email: "subscriber@example.com", metadata: [{ key: "wp_capabilities", value: { subscriber: true } }] },
        { id: 11, login: "unknown", email: "unknown@example.com" },
      ],
    });

    const response = await request(app).get("/wordpress/sub-123/wordpress/wp-app/users").expect(200);

    expect(response.body.users).toEqual([
      { id: "7", username: "admin", email: "admin@example.com", displayName: null },
      { id: "8", username: "editor", email: "editor@example.com", displayName: null },
      { id: "9", username: "author", email: "author@example.com", displayName: null },
      { id: "10", username: "subscriber", email: "subscriber@example.com", displayName: null },
      { id: "11", username: "unknown", email: "unknown@example.com", displayName: null },
    ]);
  });

  it("returns 400 when PATCH WordPress user body has no documented fields", async () => {
    await request(app)
      .patch("/wordpress/sub-123/wordpress/wp-app/users/7")
      .send({ login: "hacker", role: "administrator" })
      .expect(400);
    expect(mockUpdateWordpressUser).not.toHaveBeenCalled();
  });

  it("forwards supported NewWpUser fields to Enhance", async () => {
    mockCreateWordpressUser.mockResolvedValue({});

    await request(app)
      .post("/wordpress/sub-123/wordpress/wp-app/users")
      .send({
        login: "testing",
        email: "test@gvps.cloud",
        password: "Password123!",
        ignored: "field",
      })
      .expect(200);

    expect(mockCreateWordpressUser).toHaveBeenCalledWith(
      "cust-org-123",
      "web-123",
      "wp-app",
      {
        login: "testing",
        name: "testing",
        email: "test@gvps.cloud",
        password: "Password123!",
      },
    );
  });

  it("returns Enhance validation status and message when WordPress user create fails", async () => {
    const { EnhanceApiError } = await import("../../services/enhanceService.js");
    mockCreateWordpressUser.mockRejectedValue(
      new EnhanceApiError("Enhance API error: 400 Bad Request", 400, "Json deserialize error: missing field `name`"),
    );

    const response = await request(app)
      .post("/wordpress/sub-123/wordpress/wp-app/users")
      .send({
        login: "testing",
        name: "Testing",
        email: "test@gvps.cloud",
        password: "Password123!",
      })
      .expect(400);

    expect(response.body).toEqual({ error: "Json deserialize error: missing field `name`" });
  });

  it("whitelists PATCH WordPress user body to UpdateWpUser fields for Enhance", async () => {
    mockUpdateWordpressUser.mockResolvedValue({});
    await request(app)
      .patch("/wordpress/sub-123/wordpress/wp-app/users/7")
      .send({ email: "a@b.com", name: "Nn", password: "secret", login: "x" })
      .expect(200);
    expect(mockUpdateWordpressUser).toHaveBeenCalledWith(
      "cust-org-123",
      "web-123",
      "wp-app",
      "7",
      { email: "a@b.com", name: "Nn", password: "secret" },
    );
  });

  it("forwards documented WordPress settings fields to Enhance", async () => {
    mockUpdateWordpressSettings.mockResolvedValue(undefined);

    await request(app)
      .patch("/wordpress/sub-123/wordpress/wp-app/settings")
      .send({
        autoUpdateCore: "major",
        loginAccess: ["192.0.2.10", ""],
        coreAutoupdateMajorVersion: false,
      })
      .expect(200);

    expect(mockUpdateWordpressSettings).toHaveBeenCalledWith(
      "cust-org-123",
      "web-123",
      "wp-app",
      {
        autoUpdateCore: "major",
        loginAccess: ["192.0.2.10"],
      },
    );
  });

  it("proxies WordPress maintenance mode through the documented v2 app endpoint", async () => {
    mockGetWordpressMaintenanceMode.mockResolvedValue("active");

    const getResponse = await request(app)
      .get("/wordpress/sub-123/wordpress/wp-app/maintenance-mode")
      .expect(200);

    await request(app)
      .put("/wordpress/sub-123/wordpress/wp-app/maintenance-mode")
      .send({ enabled: false })
      .expect(200);

    expect(getResponse.body).toEqual({ status: "active" });
    expect(mockGetWordpressMaintenanceMode).toHaveBeenCalledWith("wp-app");
    expect(mockSetWordpressMaintenanceMode).toHaveBeenCalledWith("wp-app", "deactivate");
  });

  it("proxies WordPress wp-config read/write for documented debug shapes", async () => {
    mockGetWordpressConfig.mockResolvedValueOnce({ WpDebug: false });

    await request(app).get("/wordpress/sub-123/wordpress/wp-app/wp-config/WpDebug").expect(200);

    mockSetWordpressConfig.mockResolvedValue(undefined);

    await request(app)
      .put("/wordpress/sub-123/wordpress/wp-app/wp-config")
      .send({ WpDebugLog: true })
      .expect(200);

    expect(mockGetWordpressConfig).toHaveBeenCalledWith("cust-org-123", "web-123", "wp-app", "WpDebug");
    expect(mockSetWordpressConfig).toHaveBeenCalledWith(
      "cust-org-123",
      "web-123",
      "wp-app",
      { WpDebugLog: true },
    );
  });

  it("passes refreshCache through WordPress plugin and theme list routes", async () => {
    mockGetWordpressPlugins.mockResolvedValue({ items: [] });
    mockGetWordpressThemes.mockResolvedValue({ items: [] });

    await request(app).get("/wordpress/sub-123/wordpress/wp-app/plugins?refreshCache=true").expect(200);
    await request(app).get("/wordpress/sub-123/wordpress/wp-app/themes?refreshCache=true").expect(200);

    expect(mockGetWordpressPlugins).toHaveBeenCalledWith("cust-org-123", "web-123", "wp-app", {
      refreshCache: true,
    });
    expect(mockGetWordpressThemes).toHaveBeenCalledWith("cust-org-123", "web-123", "wp-app", {
      refreshCache: true,
    });
  });

  it("forwards WordPress plugin status and auto-update payloads to Enhance", async () => {
    mockUpdateWordpressPluginSettings.mockResolvedValue(undefined);

    await request(app)
      .patch("/wordpress/sub-123/wordpress/wp-app/plugins/akismet")
      .send({ active: false, autoUpdateEnabled: true })
      .expect(200);

    expect(mockUpdateWordpressPluginSettings).toHaveBeenCalledWith(
      "cust-org-123",
      "web-123",
      "wp-app",
      "akismet",
      { status: "inactive", autoUpdate: "enabled" },
    );
  });

  it("forwards WordPress theme auto-update toggles to Enhance", async () => {
    mockSetWordpressThemeAutoUpdateStatus.mockResolvedValue(undefined);

    await request(app)
      .patch("/wordpress/sub-123/wordpress/wp-app/themes/twentytwentyfive/auto-update")
      .send({ enabled: true })
      .expect(200);

    expect(mockSetWordpressThemeAutoUpdateStatus).toHaveBeenCalledWith(
      "cust-org-123",
      "web-123",
      "wp-app",
      "twentytwentyfive",
      true,
    );
  });

  it("normalizes WordPress.org plugin catalog responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        info: { results: 1, pages: 1 },
        plugins: [
          {
            slug: "woocommerce",
            name: "WooCommerce",
            version: "9.0.0",
            active_installs: 5000000,
            icons: { "1x": "https://plugins.svn.wordpress.org/woocommerce/icon-128x128.png" },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app).get("/wordpress/catalog/plugins?search=shop").expect(200);

    expect(response.body.items[0]).toMatchObject({
      kind: "plugin",
      slug: "woocommerce",
      name: "WooCommerce",
      version: "9.0.0",
      activeInstalls: 5000000,
      imageUrl: "https://plugins.svn.wordpress.org/woocommerce/icon-128x128.png",
    });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("query_plugins"), expect.any(Object));
  });

  it("resolves relative Enhance file manager paths against the panel origin", async () => {
    mockGetWebsite.mockResolvedValue({ filerdAddress: "/file-manager" });
    mockGetSiteAccessToken.mockResolvedValue("access-token-123");

    const response = await request(app).post("/web/sub-123/file-manager").expect(200);

    expect(response.body.url).toBe("https://panel.example.com/file-manager?accessToken=access-token-123");
  });

  it("blocks access to sub-routes when subscription is cancelled", async () => {
    mockGetHostingSubscriptionForOrganization.mockResolvedValue(null);

    const response = await request(app).get("/web/sub-123/website").expect(404);

    expect(response.body.error).toBe("Service not found");
    expect(mockGetWebsite).not.toHaveBeenCalled();
  });

  it("blocks access to sub-routes when subscription is suspended", async () => {
    mockGetHostingSubscriptionForOrganization.mockResolvedValue(null);

    const response = await request(app).get("/dns/sub-123/domains").expect(404);

    expect(response.body.error).toBe("Service not found");
  });
});
