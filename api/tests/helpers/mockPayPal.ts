import { vi } from "vitest";
import type {
  PaymentIntent,
  PaymentResult,
  WalletTransaction,
} from "../../services/paypalService.js";

type WalletPayoutResult = {
  success: boolean;
  payoutId?: string;
  error?: string;
};

export type MockPayPalService = {
  createPayment: ReturnType<typeof vi.fn<(...args: [PaymentIntent]) => Promise<PaymentResult>>>;
  capturePayment: ReturnType<typeof vi.fn<(...args: [string, string?]) => Promise<PaymentResult>>>;
  addFundsToWallet: ReturnType<typeof vi.fn<(...args: [string, number, string, string, Record<string, unknown>?]) => Promise<boolean>>>;
  deductFundsFromWallet: ReturnType<typeof vi.fn<(...args: [string, number, string, string, Record<string, unknown>?]) => Promise<boolean>>>;
  getWalletBalance: ReturnType<typeof vi.fn<(...args: [string]) => Promise<number | null>>>;
  getWalletTransactions: ReturnType<typeof vi.fn<(...args: [string, number?, number?]) => Promise<WalletTransaction[]>>>;
  createPayout: ReturnType<typeof vi.fn<(...args: [string, number, string, string]) => Promise<WalletPayoutResult>>>;
};

export function createMockPayPalService(
  overrides: Partial<MockPayPalService> = {},
): MockPayPalService {
  const service: MockPayPalService = {
    createPayment: vi.fn(async () => ({
      success: true,
      paymentId: "mock-order-id",
      approvalUrl: "https://example.test/paypal/approve/mock-order-id",
    })),
    capturePayment: vi.fn(async (orderId) => ({
      success: true,
      paymentId: orderId,
    })),
    addFundsToWallet: vi.fn(async () => true),
    deductFundsFromWallet: vi.fn(async () => true),
    getWalletBalance: vi.fn(async () => 0),
    getWalletTransactions: vi.fn(async () => []),
    createPayout: vi.fn(async () => ({
      success: true,
      payoutId: "mock-payout-id",
    })),
    ...overrides,
  };

  vi.mock("../../services/paypalService.js", () => ({
    PayPalService: service,
  }));

  return service;
}
