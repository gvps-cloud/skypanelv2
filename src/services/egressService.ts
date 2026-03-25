/**
 * Egress Credit Service for SkyPanelV2 Frontend
 * Handles egress credits API calls
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export interface CreditPack {
  id: string;
  gb: number;
  price: number;
  isPopular?: boolean;
  isRecommended?: boolean;
}

export interface EgressCreditBalance {
  creditsGb: number;
  warning: boolean;
}

export interface CreditPurchase {
  id: string;
  organizationId: string;
  packId: string;
  creditsGb: number;
  amountPaid: number;
  paymentTransactionId: string | null;
  createdAt: string;
}

export interface HourlyReading {
  id: string;
  vpsInstanceId: string;
  organizationId: string;
  providerInstanceId: number;
  transferUsedGb: number;
  deltaGb: number;
  creditsDeductedGb: number;
  readingAt: string;
}

export interface VPSUsageSummary {
  vpsId: string;
  label: string;
  monthlyCreditsUsed: number;
  organizationBalance: number;
  organizationWarning: boolean;
}

export interface EgressPurchaseResult {
  success: boolean;
  paymentId?: string;
  approvalUrl?: string;
  packId?: string;
  amount?: number;
  creditsGb?: number;
  error?: string;
}

class EgressService {
  private getAuthHeaders(organizationIdOverride?: string): HeadersInit {
    const token = localStorage.getItem("auth_token");
    const userStr = localStorage.getItem("auth_user");
    let organizationId: string | undefined;

    // Prefer explicit override from caller
    if (organizationIdOverride) {
      organizationId = organizationIdOverride;
    } else if (userStr) {
      try {
        const user = JSON.parse(userStr);
        organizationId = user.organizationId;
      } catch {
        // ignore
      }
    }

    return {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
      ...(organizationId && { "X-Organization-ID": organizationId }),
    };
  }

  /**
   * Get current egress credit balance
   */
  async getBalance(): Promise<{
    success: boolean;
    data?: EgressCreditBalance;
    error?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/egress/credits`, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to get credit balance",
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error("Get egress balance error:", error);
      return {
        success: false,
        error: "Network error occurred",
      };
    }
  }

  /**
   * Get available credit packs
   */
  async getCreditPacks(): Promise<{
    success: boolean;
    data?: CreditPack[];
    error?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/egress/credits/packs`, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to get credit packs",
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error("Get credit packs error:", error);
      return {
        success: false,
        error: "Network error occurred",
      };
    }
  }

  /**
   * Initialize purchase of egress credit pack
   */
  async purchaseCredits(packId: string): Promise<EgressPurchaseResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/egress/credits/purchase`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ packId }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to create purchase",
        };
      }

      return {
        success: true,
        paymentId: data.paymentId,
        approvalUrl: data.approvalUrl,
        packId: data.packId,
        amount: data.amount,
        creditsGb: data.creditsGb,
      };
    } catch (error) {
      console.error("Purchase credits error:", error);
      return {
        success: false,
        error: "Network error occurred",
      };
    }
  }

  /**
   * Get purchase history
   */
  async getPurchaseHistory(limit = 50): Promise<{
    success: boolean;
    data?: CreditPurchase[];
    error?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/egress/credits/history?limit=${limit}`, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to get purchase history",
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error("Get purchase history error:", error);
      return {
        success: false,
        error: "Network error occurred",
      };
    }
  }

  /**
   * Get hourly usage for a specific VPS
   */
  async getVPSUsage(vpsId: string, limit = 100): Promise<{
    success: boolean;
    data?: {
      vpsId: string;
      label: string;
      usage: HourlyReading[];
    };
    error?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/egress/usage/${vpsId}?limit=${limit}`, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to get VPS usage",
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error("Get VPS usage error:", error);
      return {
        success: false,
        error: "Network error occurred",
      };
    }
  }

  /**
   * Get VPS usage summary (current month)
   */
  async getVPSUsageSummary(vpsId: string): Promise<{
    success: boolean;
    data?: VPSUsageSummary;
    error?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/egress/usage/${vpsId}/summary`, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to get VPS usage summary",
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error("Get VPS usage summary error:", error);
      return {
        success: false,
        error: "Network error occurred",
      };
    }
  }

  /**
   * Get current wallet balance for an organization
   */
  async getWalletBalance(_organizationId: string): Promise<{
    success: boolean;
    data?: { balance: number };
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/egress/credits/wallet-balance`,
        {
          method: "GET",
          headers: this.getAuthHeaders(_organizationId),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to get wallet balance",
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error("Get wallet balance error:", error);
      return {
        success: false,
        error: "Network error occurred",
      };
    }
  }

  /**
   * Purchase egress credits using wallet balance
   */
  async purchaseWithWallet(
    organizationId: string,
    packId: string,
  ): Promise<{
    success: boolean;
    message?: string;
    data?: {
      newBalance: number;
      walletDeducted: number;
    };
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/egress/credits/purchase/wallet`,
        {
          method: "POST",
          headers: this.getAuthHeaders(organizationId),
          body: JSON.stringify({ organizationId, packId }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to purchase credits",
        };
      }

      return {
        success: true,
        message: data.message,
        data: data.data,
      };
    } catch (error) {
      console.error("Purchase with wallet error:", error);
      return {
        success: false,
        error: "Network error occurred",
      };
    }
  }

  /**
   * Get organization's egress credit balance and purchase history
   */
  async getOrganizationEgressCredits(organizationId: string, limit = 20): Promise<{
    success: boolean;
    data?: {
      organizationId: string;
      creditsGb: number;
      warning: boolean;
      purchaseHistory: CreditPurchase[];
    };
    error?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/organizations/${organizationId}/egress/credits?limit=${limit}`, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to get organization egress credits",
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error("Get organization egress credits error:", error);
      return {
        success: false,
        error: "Network error occurred",
      };
    }
  }

  /**
   * Get available credit packs (organization-scoped)
   */
  async getOrganizationCreditPacks(organizationId: string): Promise<{
    success: boolean;
    data?: CreditPack[];
    error?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/organizations/${organizationId}/egress/credits/packs`, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to get credit packs",
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error("Get credit packs error:", error);
      return {
        success: false,
        error: "Network error occurred",
      };
    }
  }

  /**
   * Initiate organization egress credit purchase
   */
  async initiateOrganizationPurchase(
    organizationId: string,
    packId: string,
  ): Promise<{
    success: boolean;
    paymentId?: string;
    approvalUrl?: string;
    packId?: string;
    amount?: number;
    creditsGb?: number;
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/organizations/${organizationId}/egress/credits/purchase`,
        {
          method: "POST",
          headers: this.getAuthHeaders(organizationId),
          body: JSON.stringify({ packId }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to create purchase",
        };
      }

      return {
        success: true,
        paymentId: data.paymentId,
        approvalUrl: data.approvalUrl,
        packId: data.packId,
        amount: data.amount,
        creditsGb: data.creditsGb,
      };
    } catch (error) {
      console.error("Initiate purchase error:", error);
      return {
        success: false,
        error: "Network error occurred",
      };
    }
  }

  /**
   * Complete egress credit purchase for an organization
   *
   * This is the ONLY method for completing egress credit purchases.
   * Previous method completePurchase() has been removed to avoid confusion.
   *
   * @param organizationId - Target organization ID from URL parameter
   * @param paymentId - PayPal order ID
   * @param packId - Credit pack ID
   */
  async completePurchase(
    organizationId: string,
    paymentId: string,
    packId: string
  ): Promise<{
    success: boolean;
    message?: string;
    data?: {
      organizationId: string;
      newBalance: number;
      warning: boolean;
    };
    error?: string;
  }> {
    try {
    const response = await fetch(
      `${API_BASE_URL}/organizations/${organizationId}/egress/credits/purchase/complete`,
      {
        method: "POST",
        headers: this.getAuthHeaders(organizationId),
        body: JSON.stringify({ paymentId, packId }),
      },
    );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to complete purchase",
        };
      }

      return {
        success: true,
        message: data.message,
        data: data.data,
      };
    } catch (error) {
      console.error("Complete purchase error:", error);
      return {
        success: false,
        error: "Network error occurred",
      };
    }
  }

  /**
   * Admin: Get credit pack settings and warning threshold
   */
  async getAdminPackSettings(): Promise<{
    success: boolean;
    data?: {
      packs: CreditPack[];
      warningThresholdGb: number;
    };
    error?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/egress/admin/settings/packs`, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to get pack settings",
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error("Get admin pack settings error:", error);
      return {
        success: false,
        error: "Network error occurred",
      };
    }
  }

  /**
   * Admin: Update credit pack settings and warning threshold
   */
  async updateAdminPackSettings(
    packs: CreditPack[],
    warningThresholdGb?: number
  ): Promise<{
    success: boolean;
    message?: string;
    data?: {
      packs: CreditPack[];
      warningThresholdGb?: number;
    };
    error?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/egress/admin/settings/packs`, {
        method: "PUT",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ packs, warningThresholdGb }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to update pack settings",
        };
      }

      return {
        success: true,
        message: data.message,
        data: data.data,
      };
    } catch (error) {
      console.error("Update admin pack settings error:", error);
      return {
        success: false,
        error: "Network error occurred",
      };
    }
  }
}

export const egressService = new EgressService();
