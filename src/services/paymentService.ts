/**
 * Payment Service for SkyPanelV2 Frontend
 * Handles PayPal payments and wallet management
 */

import { apiClient } from '@/lib/api';



export interface PaymentIntent {

  amount: number;

  currency: string;

  description: string;

  walletType?: 'main' | 'hosting';

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

  walletType?: 'main' | 'hosting';

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



  /**

   * Create a payment intent for adding funds to wallet

   */

  async createPayment(paymentIntent: PaymentIntent): Promise<PaymentResult> {
    try {
      const data = await apiClient.post<any>('/payments/create-payment', paymentIntent);
      return { success: true, paymentId: data.paymentId, approvalUrl: data.approvalUrl };
    } catch (error: any) {
      console.error('Create payment error:', error);
      return { success: false, error: error.message || 'Network error occurred' };
    }
  }



  /**

   * Capture a PayPal payment after user approval

   */

  async capturePayment(orderId: string): Promise<PaymentResult> {
    try {
      const data = await apiClient.post<any>(`/payments/capture-payment/${orderId}`);
      return { success: true, paymentId: data.paymentId };
    } catch (error: any) {
      console.error('Capture payment error:', error);
      return { success: false, error: error.message || 'Network error occurred' };
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
      const data = await apiClient.get<any>('/payments/config');

      if (!data.success) {
        return { success: false, error: data?.error || 'Failed to load PayPal configuration' };
      }

      const configData = (data.config ?? {}) as Record<string, unknown>;
      const clientId = typeof configData.clientId === 'string' ? configData.clientId : '';

      if (!clientId) {
        return { success: false, error: 'PayPal configuration is incomplete. Please contact support.' };
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
    } catch (error: any) {
      console.error('Get PayPal config error:', error);
      return { success: false, error: error.message || 'Failed to load PayPal configuration' };
    }
  }



  /**

   * Get wallet balance for the organization

   */

  async getWalletBalance(): Promise<WalletBalance | null> {
    try {
      const data = await apiClient.get<any>('/payments/wallet/balance');
      return { balance: data.balance };
    } catch (error: any) {
      console.error('Get wallet balance error:', error);
      return null;
    }
  }

  async getHostingWalletBalance(): Promise<WalletBalance | null> {
    try {
      const data = await apiClient.get<any>('/payments/wallet/hosting/balance');
      return { balance: data.balance };
    } catch (error: any) {
      console.error('Get hosting wallet balance error:', error);
      return null;
    }
  }

  async fundHostingWalletFromMain(amount: number): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await apiClient.post<any>('/payments/wallet/hosting/fund', { amount });
      return { success: true };
    } catch (error: any) {
      console.error('Fund hosting wallet error:', error);
      return { success: false, error: error.message || 'Network error occurred' };
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
      const data = await apiClient.get<any>(`/payments/wallet/transactions?limit=${limit}&offset=${offset}`);
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
                  ? parseFloat((balanceAfter - amount).toFixed(6))
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
          const walletTypeValue = txRecord.walletType ?? txRecord.wallet_type;
          const walletType = walletTypeValue === 'hosting' ? 'hosting' : 'main';

          return {
            id: String(txRecord.id ?? ''),
            amount,
            type,
            description,
            paymentId,
            currency: currencyValue,
            balanceBefore,
            balanceAfter,
            walletType,
            createdAt,
          };
        }),
        hasMore: Boolean(data.pagination?.hasMore),
      };
    } catch (error: any) {
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
      const data = await apiClient.get<any>(`/payments/history?${params.toString()}`);
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
    } catch (error: any) {
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
      const data = await apiClient.get<any>(`/payments/transactions/${transactionId}`);
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
    } catch (error: any) {
      console.error('Get transaction error:', error);
      return { success: false, error: error.message || 'Network error occurred' };
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
      const data = await apiClient.post<any>(`/invoices/from-transaction/${transactionId}`);
      return { success: true, invoiceId: data.invoiceId, invoiceNumber: data.invoiceNumber };
    } catch (error: any) {
      console.error('Create transaction invoice error:', error);
      return { success: false, error: error.message || 'Network error occurred' };
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
      const data = await apiClient.post<any>('/payments/refund', { email, amount, currency, reason });
      return { success: true, paymentId: data.payoutId };
    } catch (error: any) {
      console.error('Create refund error:', error);
      return { success: false, error: error.message || 'Network error occurred' };
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
      const data = await apiClient.get<any>(`/invoices?limit=${limit}&offset=${offset}`);
      return { invoices: data.invoices, hasMore: data.pagination.hasMore };
    } catch (error: any) {
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
      const data = await apiClient.get<any>('/vps/uptime-summary');
      return {
        success: true,
        data: {
          totalActiveHours: data.totalActiveHours,
          totalEstimatedCost: data.totalEstimatedCost,
          vpsInstances: data.vpsInstances,
        },
      };
    } catch (error: any) {
      console.error('Get VPS uptime summary error:', error);
      return { success: false, error: error.message || 'Network error occurred' };
    }
  }



  async getBillingSummary(): Promise<{
    success: boolean;
    summary?: BillingSummary;
    error?: string;
  }> {
    try {
      const data = await apiClient.get<any>('/payments/billing/summary');
      return { success: true, summary: data.summary };
    } catch (error: any) {
      console.error('Get billing summary error:', error);
      if ((error as any).status === 403) {
        return { success: false, error: 'Organization access required' };
      }
      return { success: false, error: error.message || 'Network error occurred' };
    }
  }
}



export const paymentService = new PaymentService();
