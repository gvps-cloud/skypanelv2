/**

 * Payment Service for SkyPanelV2 Frontend

 * Handles PayPal payments and wallet management

 */



const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';



export interface PaymentIntent {

  amount: number;

  currency: string;

  description: string;

}



export interface PaymentResult {

  success: boolean;

  paymentId?: string;

  approvalUrl?: string;

  error?: string;

}



export interface PayPalClientConfig {

  clientId: string;

  currency: string;

  intent: 'capture' | 'authorize';

  mode: 'sandbox' | 'live';

  disableFunding?: string[];

  brandName?: string;

}



export interface WalletBalance {

  balance: number;

}



export interface WalletTransaction {

  id: string;

  amount: number;

  currency: string;

  type: 'credit' | 'debit';

  description: string;

  paymentId?: string;

  balanceBefore?: number | null;

  balanceAfter: number | null;

  createdAt: string;

}



export interface PaymentHistory {

  id: string;

  amount: number;

  currency: string;

  description: string;

  status: 'completed' | 'failed' | 'cancelled' | 'refunded';

  provider: string;

  providerPaymentId?: string;

  createdAt: string;

  updatedAt: string;

}



export interface PaymentTransactionDetail {

  id: string;

  organizationId: string;

  amount: number;

  currency: string;

  description: string;

  status: PaymentHistory['status'];

  provider: string;

  paymentMethod: string;

  providerPaymentId?: string;

  type: 'credit' | 'debit';

  balanceBefore: number | null;

  balanceAfter: number | null;

  metadata: Record<string, unknown> | null;

  createdAt: string;

  updatedAt: string;

}



export interface VPSUptimeInstance {

  id: string;

  label: string;

  status: string;

  createdAt: string;

  deletedAt: string | null;

  activeHours: number;

  hourlyRate: number;

  estimatedCost: number;

  lastBilledAt: string | null;

}



export interface VPSUptimeSummary {

  totalActiveHours: number;

  totalEstimatedCost: number;

  vpsInstances: VPSUptimeInstance[];

}



export interface BillingSummary {

  totalSpentThisMonth: number;

  totalSpentAllTime: number;

  activeVPSCount: number;

  monthlyEstimate: number;
}



class PaymentService {

  private getAuthHeaders(): HeadersInit {

    const token = localStorage.getItem('auth_token');

    return {

      'Content-Type': 'application/json',

      'Authorization': token ? `Bearer ${token}` : '',

    };

  }



  /**

   * Create a payment intent for adding funds to wallet

   */

  async createPayment(paymentIntent: PaymentIntent): Promise<PaymentResult> {

    try {

      const response = await fetch(`${API_BASE_URL}/payments/create-payment`, {

        method: 'POST',

        headers: this.getAuthHeaders(),

        body: JSON.stringify(paymentIntent),

      });



      const data = await response.json();



      if (!response.ok) {

        return {

          success: false,

          error: data.error || 'Failed to create payment',

        };

      }



      return {

        success: true,

        paymentId: data.paymentId,

        approvalUrl: data.approvalUrl,

      };

    } catch (error) {

      console.error('Create payment error:', error);

      return {

        success: false,

        error: 'Network error occurred',

      };

    }

  }



  /**

   * Capture a PayPal payment after user approval

   */

  async capturePayment(orderId: string): Promise<PaymentResult> {

    try {

      const response = await fetch(`${API_BASE_URL}/payments/capture-payment/${orderId}`, {

        method: 'POST',

        headers: this.getAuthHeaders(),

      });



      const data = await response.json();



      if (!response.ok) {

        return {

          success: false,

          error: data.error || 'Failed to capture payment',

        };

      }



      return {

        success: true,

        paymentId: data.paymentId,

      };

    } catch (error) {

      console.error('Capture payment error:', error);

      return {

        success: false,

        error: 'Network error occurred',

      };

    }

  }



  /**

   * Load PayPal checkout configuration for the authenticated organization

   */

  async getPayPalConfig(): Promise<{

    success: boolean;

    config?: PayPalClientConfig;

    error?: string;

  }> {

    try {

      const response = await fetch(`${API_BASE_URL}/payments/config`, {

        method: 'GET',

        headers: this.getAuthHeaders(),

      });



      const data = await response.json();



      if (!response.ok || !data.success) {

        return {

          success: false,

          error: data?.error || 'Failed to load PayPal configuration',

        };

      }



      const configData = (data.config ?? {}) as Record<string, unknown>;

      const clientId = typeof configData.clientId === 'string' ? configData.clientId : '';



      if (!clientId) {

        return {

          success: false,

          error: 'PayPal configuration is incomplete. Please contact support.',

        };

      }



      const disableFundingRaw = configData.disableFunding;

      const disableFunding = Array.isArray(disableFundingRaw)

        ? disableFundingRaw.filter((value) => typeof value === 'string') as string[]

        : undefined;



      return {

        success: true,

        config: {

          clientId,

          currency: typeof configData.currency === 'string' ? configData.currency : 'USD',

          intent: configData.intent === 'authorize' ? 'authorize' : 'capture',

          mode: configData.mode === 'live' ? 'live' : 'sandbox',

          disableFunding,

          brandName: typeof configData.brandName === 'string' ? configData.brandName : undefined,

        },

      };

    } catch (error) {

      console.error('Get PayPal config error:', error);

      return {

        success: false,

        error: 'Failed to load PayPal configuration',

      };

    }

  }



  /**

   * Get wallet balance for the organization

   */

  async getWalletBalance(): Promise<WalletBalance | null> {

    try {

      const response = await fetch(`${API_BASE_URL}/payments/wallet/balance`, {

        method: 'GET',

        headers: this.getAuthHeaders(),

      });



      const data = await response.json();



      if (!response.ok) {

        console.error('Failed to get wallet balance:', data.error);

        return null;

      }



      return {

        balance: data.balance,

      };

    } catch (error) {

      console.error('Get wallet balance error:', error);

      return null;

    }

  }



  /**

   * Get wallet transactions for the organization

   */

  async getWalletTransactions(

    limit: number = 50,

    offset: number = 0

  ): Promise<{

    transactions: WalletTransaction[];

    hasMore: boolean;

  }> {

    try {

      const response = await fetch(

        `${API_BASE_URL}/payments/wallet/transactions?limit=${limit}&offset=${offset}`,

        {

          method: 'GET',

          headers: this.getAuthHeaders(),

        }

      );



      const data = await response.json();



      if (!response.ok) {

        console.error('Failed to get wallet transactions:', data.error);

        return { transactions: [], hasMore: false };

      }



      const transactionsSource = (Array.isArray(data.transactions) ? data.transactions : []) as Array<Record<string, unknown>>;



      return {

        transactions: transactionsSource.map((tx) => {

          const amountRaw = tx.amount;

          const amountValue = typeof amountRaw === 'string'

            ? parseFloat(amountRaw)

            : typeof amountRaw === 'number'

              ? amountRaw

              : null;

          const amount = amountValue !== null && Number.isFinite(amountValue) ? amountValue : 0;

          const txRecord = tx as Record<string, unknown>;

          const balanceRaw = txRecord.balanceAfter ?? txRecord.balance_after;

          const balanceBeforeRaw = txRecord.balanceBefore ?? txRecord.balance_before;

          const balanceAfter =

            typeof balanceRaw === 'string'

              ? parseFloat(balanceRaw)

              : typeof balanceRaw === 'number' && Number.isFinite(balanceRaw)

                ? balanceRaw

                : null;

          const balanceBefore =

            typeof balanceBeforeRaw === 'string'

              ? parseFloat(balanceBeforeRaw)

              : typeof balanceBeforeRaw === 'number' && Number.isFinite(balanceBeforeRaw)

                ? balanceBeforeRaw

                : balanceAfter !== null

                  ? parseFloat((balanceAfter - amount).toFixed(4))

                  : null;

          const typeValue = (tx as Record<string, unknown>).type;

          const type = typeValue === 'credit' || typeValue === 'debit' ? typeValue : (amount >= 0 ? 'credit' : 'debit');

          const createdAtValue = (tx as Record<string, unknown>).createdAt ?? (tx as Record<string, unknown>).created_at;

          const createdAt = typeof createdAtValue === 'string' ? createdAtValue : '';

          const descriptionValue = txRecord.description;

          const description = typeof descriptionValue === 'string' ? descriptionValue : 'Unknown transaction';

          const paymentIdValue = txRecord.paymentId ?? txRecord.payment_id;

          const paymentId = typeof paymentIdValue === 'string' ? paymentIdValue : undefined;

          const currencyValue = typeof txRecord.currency === 'string' ? txRecord.currency : 'USD';



          return {

            id: String(txRecord.id ?? ''),

            amount,

            type,

            description,

            paymentId,

            currency: currencyValue,

            balanceBefore,

            balanceAfter,

            createdAt,

          };

        }),

        hasMore: Boolean(data.pagination?.hasMore),

      };

    } catch (error) {

      console.error('Get wallet transactions error:', error);

      return { transactions: [], hasMore: false };

    }

  }



  /**

   * Get payment history for the organization

   */

  async getPaymentHistory(

    limit: number = 50,

    offset: number = 0,

    status?: string

  ): Promise<{

    payments: PaymentHistory[];

    hasMore: boolean;

  }> {

    try {

      const params = new URLSearchParams({

        limit: limit.toString(),

        offset: offset.toString(),

      });



      if (status) {

        params.append('status', status);

      }



      const response = await fetch(

        `${API_BASE_URL}/payments/history?${params.toString()}`,

        {

          method: 'GET',

          headers: this.getAuthHeaders(),

        }

      );



      const data = await response.json();



      if (!response.ok) {

        console.error('Failed to get payment history:', data.error);

        return { payments: [], hasMore: false };

      }



      const paymentsSource = (Array.isArray(data.payments) ? data.payments : []) as Array<Record<string, unknown>>;



      return {

        payments: paymentsSource.map((payment) => ({

          id: String(payment.id ?? ''),

          amount: typeof payment.amount === 'string' ? parseFloat(payment.amount) : Number(payment.amount ?? 0),

          currency: typeof payment.currency === 'string' ? payment.currency : 'USD',

          description: typeof payment.description === 'string' ? payment.description : 'Payment',

          status: (payment.status as PaymentHistory['status']) ?? 'completed',

          provider: typeof payment.provider === 'string' ? payment.provider : 'unknown',

          providerPaymentId: typeof payment.provider_payment_id === 'string' ? payment.provider_payment_id : undefined,

          createdAt: typeof payment.created_at === 'string' ? payment.created_at : '',

          updatedAt: typeof payment.updated_at === 'string' ? payment.updated_at : '',

        })),

        hasMore: Boolean(data.pagination?.hasMore),

      };

    } catch (error) {

      console.error('Get payment history error:', error);

      return { payments: [], hasMore: false };

    }

  }



  /**

   * Get a single payment transaction by ID

   */

  async getTransactionById(transactionId: string): Promise<{

    success: boolean;

    transaction?: PaymentTransactionDetail;

    error?: string;

  }> {

    try {

      const response = await fetch(`${API_BASE_URL}/payments/transactions/${transactionId}`, {

        method: 'GET',

        headers: this.getAuthHeaders(),

      });



      const data = await response.json();



      if (!response.ok) {

        return {

          success: false,

          error: data.error || 'Failed to load transaction',

        };

      }



      const transaction = data.transaction;



      return {

        success: true,

        transaction: {

          id: transaction.id,

          organizationId: transaction.organizationId,

          amount: transaction.amount,

          currency: transaction.currency,

          description: transaction.description,

          status: transaction.status,

          provider: transaction.provider,

          paymentMethod: transaction.paymentMethod,

          providerPaymentId: transaction.providerPaymentId,

          type: transaction.type,

          balanceBefore: transaction.balanceBefore ?? null,

          balanceAfter: transaction.balanceAfter,

          metadata: transaction.metadata || null,

          createdAt: transaction.createdAt,

          updatedAt: transaction.updatedAt,

        },

      };

    } catch (error) {

      console.error('Get transaction error:', error);

      return {

        success: false,

        error: 'Network error occurred',

      };

    }

  }



  /**

   * Create an invoice from a single transaction

   */

  async createInvoiceFromTransaction(transactionId: string): Promise<{

    success: boolean;

    invoiceId?: string;

    invoiceNumber?: string;

    error?: string;

  }> {

    try {

      const response = await fetch(`${API_BASE_URL}/invoices/from-transaction/${transactionId}`, {

        method: 'POST',

        headers: this.getAuthHeaders(),

      });



      const data = await response.json();



      if (!response.ok) {

        return {

          success: false,

          error: data.error || 'Failed to generate invoice',

        };

      }



      return {

        success: true,

        invoiceId: data.invoiceId,

        invoiceNumber: data.invoiceNumber,

      };

    } catch (error) {

      console.error('Create transaction invoice error:', error);

      return {

        success: false,

        error: 'Network error occurred',

      };

    }

  }



  /**

   * Create a refund/payout

   */

  async createRefund(

    email: string,

    amount: number,

    currency: string,

    reason: string

  ): Promise<PaymentResult> {

    try {

      const response = await fetch(`${API_BASE_URL}/payments/refund`, {

        method: 'POST',

        headers: this.getAuthHeaders(),

        body: JSON.stringify({

          email,

          amount,

          currency,

          reason,

        }),

      });



      const data = await response.json();



      if (!response.ok) {

        return {

          success: false,

          error: data.error || 'Failed to create refund',

        };

      }



      return {

        success: true,

        paymentId: data.payoutId,

      };

    } catch (error) {

      console.error('Create refund error:', error);

      return {

        success: false,

        error: 'Network error occurred',

      };

    }

  }



  /**

   * List invoices for the organization

   */

  async getInvoices(

    limit: number = 50,

    offset: number = 0

  ): Promise<{

    invoices: Array<{

      id: string;

      invoiceNumber: string;

      totalAmount: number;

      currency: string;

      createdAt: string;

    }>;

    hasMore: boolean;

  }> {

    try {

      const response = await fetch(

        `${API_BASE_URL}/invoices?limit=${limit}&offset=${offset}`,

        {

          method: 'GET',

          headers: this.getAuthHeaders(),

        }

      );



      const data = await response.json();



      if (!response.ok) {

        console.error('Failed to get invoices:', data.error);

        return { invoices: [], hasMore: false };

      }



      return {

        invoices: data.invoices,

        hasMore: data.pagination.hasMore,

      };

    } catch (error) {

      console.error('Get invoices error:', error);

      return { invoices: [], hasMore: false };

    }

  }



  /**

   * Get VPS uptime summary for the organization

   */

  async getVPSUptimeSummary(): Promise<{

    success: boolean;

    data?: VPSUptimeSummary;

    error?: string;

  }> {

    try {

      const response = await fetch(`${API_BASE_URL}/vps/uptime-summary`, {

        method: 'GET',

        headers: this.getAuthHeaders(),

      });



      const data = await response.json();



      if (!response.ok) {

        return {

          success: false,

          error: data.error || 'Failed to load VPS uptime data',

        };

      }



      return {

        success: true,

        data: {

          totalActiveHours: data.totalActiveHours,

          totalEstimatedCost: data.totalEstimatedCost,

          vpsInstances: data.vpsInstances,

        },

      };

    } catch (error) {

      console.error('Get VPS uptime summary error:', error);

      return {

        success: false,

        error: 'Network error occurred',

      };

    }

  }



  async getBillingSummary(): Promise<{

    success: boolean;

    summary?: BillingSummary;

    error?: string;

  }> {

    try {

      const response = await fetch(`${API_BASE_URL}/payments/billing/summary`, {

        method: 'GET',

        headers: this.getAuthHeaders(),

      });



      const data = await response.json();



      if (!response.ok) {
        if (response.status === 403) {
          return { success: false, error: 'Organization access required' };
        }
        return {
          success: false,
          error: data.error || 'Failed to load billing summary',
        };
      }



      return {

        success: true,

        summary: data.summary,

      };

    } catch (error) {

      console.error('Get billing summary error:', error);

      return {

        success: false,

        error: 'Network error occurred',

      };

    }

  }



}



export const paymentService = new PaymentService();
