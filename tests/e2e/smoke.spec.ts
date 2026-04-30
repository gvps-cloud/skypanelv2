import { test, expect, type Page } from "@playwright/test";

const TEST_ORG = {
  name: "Playwright Test Org",
  slug: "playwright-test-org",
};

test.describe("Smoke Tests", () => {
  test("homepage loads without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/");
    await expect(page).toHaveTitle(/GVPSCloud/i);
    await expect(page.locator("nav")).toBeVisible();

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("404") &&
        !e.includes("net::ERR")
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("login page renders and has form fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("register page renders", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible();
  });

  test("pricing page is publicly accessible", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: /pricing/i })).toBeVisible();
  });

  test("navigation to login from homepage", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /sign in/i }).first().click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Authenticated Smoke Tests", () => {
  let authPage: Page;

  test.beforeEach(async ({ browser }) => {
    authPage = await browser.newPage();
    const loginPage = await browser.newPage();
    await loginPage.goto("/login");
    const email = process.env.E2E_TEST_EMAIL || "admin@gvps.cloud";
    const password = process.env.E2E_TEST_PASSWORD || "test-password";
    await loginPage.getByLabel(/email/i).fill(email);
    await loginPage.getByLabel(/password/i).fill(password);
    await loginPage.getByRole("button", { name: /sign in/i }).click();
    await loginPage.waitForURL(/\/(dashboard|vps)/);
    const context = await loginPage.context();
    const authContext = await context.storageState();
    await authPage.setContent("");
    const newContext = await browser.newContext({ storageState: authContext });
    authPage = await newContext.newPage();
    await authPage.goto("/dashboard");
  });

  test.afterEach(async () => {
    await authPage.close();
  });

  test("dashboard loads for authenticated user", async () => {
    await expect(authPage.getByText(/dashboard/i)).toBeVisible();
  });

  test("VPS list page loads", async () => {
    await authPage.goto("/vps");
    await expect(authPage.getByText(/virtual private servers/i)).toBeVisible();
  });

  test("billing page loads", async () => {
    await authPage.goto("/billing");
    await expect(authPage.getByText(/billing/i)).toBeVisible();
  });

  test("settings page loads", async () => {
    await authPage.goto("/settings");
    await expect(authPage.getByText(/settings/i)).toBeVisible();
  });

  test("no console errors on authenticated pages", async () => {
    const errors: string[] = [];
    authPage.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await authPage.goto("/dashboard");
    await authPage.waitForLoadState("networkidle");

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("Failed to load resource") &&
        !e.includes("net::ERR")
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
