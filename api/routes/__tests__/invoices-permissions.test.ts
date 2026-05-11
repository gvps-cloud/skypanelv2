import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import invoicesRouter from "../invoices.js";

const mockCheckPermission = vi.hoisted(() => vi.fn());
const mockQuery = vi.hoisted(() => vi.fn());
const mockGetWalletTransactions = vi.hoisted(() => vi.fn());
const mockListEgressInvoiceItems = vi.hoisted(() => vi.fn());

vi.mock("../../middleware/auth.js", () => ({
  authenticateToken: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).user = {
      id: "00000000-0000-0000-0000-000000000001",
      organizationId: "00000000-0000-0000-0000-000000000002",
      role: "user",
    };
    next();
  },
  requireOrganization: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("../../services/roles.js", () => ({
  RoleService: {
    checkPermission: (...args: unknown[]) => mockCheckPermission(...args),
  },
}));

vi.mock("../../lib/database.js", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

vi.mock("../../services/paypalService.js", () => ({
  PayPalService: {
    getWalletTransactions: (...args: unknown[]) => mockGetWalletTransactions(...args),
  },
}));

vi.mock("../../services/egressBillingService.js", () => ({
  EgressBillingService: {
    listInvoiceItemsForPeriod: (...args: unknown[]) => mockListEgressInvoiceItems(...args),
  },
}));

vi.mock("../../services/invoiceService.js", () => ({
  injectInvoiceThemeIntoHTML: (html: string) => html,
  InvoiceService: {
    listInvoices: vi.fn(),
    getInvoice: vi.fn(),
    generateInvoiceFromTransactions: vi.fn(),
    generateInvoiceFromBillingCycles: vi.fn(),
    generateInvoiceFromHostingCycles: vi.fn(),
    generateInvoiceHTML: vi.fn(),
    createInvoice: vi.fn(),
    resolveWalletBalances: vi.fn(),
  },
}));

vi.mock("../../services/themeService.js", () => ({
  themeService: {
    getThemeConfig: vi.fn(),
  },
  resolveThemePalette: vi.fn(),
}));

vi.mock("../../config/index.js", () => ({
  config: {
    COMPANY_NAME: "SkyPanel",
    COMPANY_LOGO_URL: undefined,
  },
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/invoices", invoicesRouter);
  return app;
}

describe("Invoice route permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPermission.mockResolvedValue(false);
  });

  it.each([
    ["single transaction invoice", "/invoices/from-transaction/11111111-1111-4111-8111-111111111111", {}],
    ["wallet transaction invoice", "/invoices/from-transactions", {}],
    ["VPS billing-cycle invoice", "/invoices/from-billing-cycles", {}],
    ["hosting billing-cycle invoice", "/invoices/from-hosting-cycles", {}],
  ] as const)("requires billing_manage for %s", async (_label, path, body) => {
    const res = await request(createApp()).post(path).send(body);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, error: "Insufficient permissions" });
    expect(mockCheckPermission).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000002",
      "billing_manage",
    );
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockGetWalletTransactions).not.toHaveBeenCalled();
    expect(mockListEgressInvoiceItems).not.toHaveBeenCalled();
  });
});
