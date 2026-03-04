/**
 * Invoice Service for SkyPanelV2
 * Handles invoice generation, storage, and export
 */

import { query } from '../lib/database.js';
import type { ThemePalette } from './themeService.js';

export interface InvoiceData {
  id: string;
  invoiceNumber: string;
  organizationId: string;
  userId?: string;
  title?: string;
  description?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  createdAt: Date;
  dueDate?: Date;
  status: 'draft' | 'issued' | 'paid' | 'cancelled';
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

const defaultInvoicePalette: ThemePalette = {
  background: '#ffffff',
  foreground: '#333333',
  card: '#ffffff',
  cardForeground: '#333333',
  muted: '#f8f9fa',
  mutedForeground: '#666666',
  border: '#e0e0e0',
  primary: '#007bff',
  primaryForeground: '#ffffff',
  secondary: '#e3f2fd',
  secondaryForeground: '#1976d2',
  accent: '#388e3c',
  accentForeground: '#ffffff',
  destructive: '#d32f2f',
  destructiveForeground: '#ffffff',
  ring: '#007bff',
};

export class InvoiceService {
  private static invoiceTableEnsured = false;

  /**
   * Ensure the billing_invoices table exists before performing operations.
   */
  private static async ensureInvoiceTable(): Promise<void> {
    if (this.invoiceTableEnsured) {
      return;
    }

    try {
      await query(`
        CREATE TABLE IF NOT EXISTS billing_invoices (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          invoice_number TEXT NOT NULL,
          html_content TEXT NOT NULL,
          data JSONB NOT NULL DEFAULT '{}',
          total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          currency TEXT NOT NULL DEFAULT 'USD',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await query(
        `CREATE INDEX IF NOT EXISTS idx_billing_invoices_org ON billing_invoices(organization_id)`
      );

      await query(
        `CREATE INDEX IF NOT EXISTS idx_billing_invoices_created_at ON billing_invoices(created_at)`
      );

      this.invoiceTableEnsured = true;
    } catch (error) {
      console.error('Failed to ensure billing_invoices table exists:', error);
      throw error;
    }
  }

  /**
   * Generate HTML invoice from transaction data
   */
  static generateInvoiceHTML(
    invoiceData: InvoiceData,
    companyName?: string,
    companyLogo?: string,
    themePalette?: ThemePalette
  ): string {
    const resolvedCompanyName = (companyName && companyName.trim())
      || (process.env['COMPANY-NAME'] && process.env['COMPANY-NAME'].trim())
      || (process.env.COMPANY_NAME && process.env.COMPANY_NAME.trim())
      || (process.env.VITE_COMPANY_NAME && process.env.VITE_COMPANY_NAME.trim())
      || 'SkyVPS360';

    const formattedDate = invoiceData.createdAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const palette = themePalette ?? defaultInvoicePalette;
    const colors = {
      background: palette.background,
      foreground: palette.foreground,
      card: palette.card,
      cardForeground: palette.cardForeground,
      muted: palette.muted,
      mutedForeground: palette.mutedForeground,
      border: palette.border,
      primary: palette.primary,
      primaryForeground: palette.primaryForeground,
      secondary: palette.secondary,
      secondaryForeground: palette.secondaryForeground,
      accent: palette.accent,
      accentForeground: palette.accentForeground,
      destructive: palette.destructive,
      destructiveForeground: palette.destructiveForeground,
      ring: palette.ring,
    };

    const borderStyle = `1px solid ${colors.border}`;

    const itemsHTML = invoiceData.items
      .map(
        (item) => `
      <tr>
        <td style="padding: 12px; border-bottom: ${borderStyle}; color: ${colors.cardForeground};">${item.description}</td>
        <td style="padding: 12px; border-bottom: ${borderStyle}; text-align: center; color: ${colors.cardForeground};">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: ${borderStyle}; text-align: right; color: ${colors.cardForeground};">$${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 12px; border-bottom: ${borderStyle}; text-align: right; color: ${colors.cardForeground};">$${item.amount.toFixed(2)}</td>
      </tr>
    `
      )
      .join('');

    const logoHTML = companyLogo
      ? `<img src="${companyLogo}" alt="${resolvedCompanyName} logo" style="height: 60px; margin-bottom: 20px;" />`
      : '';

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice ${invoiceData.invoiceNumber}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          color: ${colors.foreground};
          background: ${colors.background};
          line-height: 1.6;
        }
        .container {
          max-width: 850px;
          margin: 0 auto;
          padding: 40px;
          background: ${colors.card};
          color: ${colors.cardForeground};
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
          border-bottom: 2px solid ${colors.primary};
          padding-bottom: 20px;
        }
        .company-info {
          flex: 1;
        }
        .company-info h1 {
          font-size: 28px;
          color: ${colors.primary};
          margin: 10px 0;
        }
        .invoice-info {
          text-align: right;
        }
        .invoice-info h2 {
          font-size: 32px;
          color: ${colors.primary};
          margin-bottom: 10px;
        }
        .invoice-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin: 20px 0 40px 0;
          padding: 20px;
          background: ${colors.secondary};
          border-radius: 5px;
        }
        .invoice-meta-item {
          display: flex;
          flex-direction: column;
        }
        .invoice-meta-label {
          font-weight: 600;
          color: ${colors.mutedForeground};
          font-size: 12px;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .invoice-meta-value {
          font-size: 16px;
          color: ${colors.cardForeground};
        }
        table {
          width: 100%;
          margin: 30px 0;
          border-collapse: collapse;
        }
        table thead {
          background: ${colors.secondary};
        }
        table th {
          padding: 12px;
          text-align: left;
          font-weight: 600;
          color: ${colors.secondaryForeground};
          border-bottom: 2px solid ${colors.border};
        }
        table td {
          padding: 12px;
          border-bottom: ${borderStyle};
        }
        table tr:last-child td {
          border-bottom: none;
        }
        .totals {
          display: flex;
          justify-content: flex-end;
          margin: 30px 0;
        }
        .totals-section {
          width: 300px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: ${borderStyle};
        }
        .totals-row.total {
          border-bottom: 2px solid ${colors.primary};
          font-size: 18px;
          font-weight: 600;
          color: ${colors.primary};
          padding: 15px 0;
        }
        .status-badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          margin-top: 20px;
          background: ${colors.secondary};
          color: ${colors.secondaryForeground};
        }
        .status-badge.issued {
          background: ${colors.primary};
          color: ${colors.primaryForeground};
        }
        .status-badge.paid {
          background: ${colors.accent};
          color: ${colors.accentForeground};
        }
        .status-badge.draft {
          background: ${colors.muted};
          color: ${colors.mutedForeground};
        }
        .status-badge.cancelled {
          background: ${colors.destructive};
          color: ${colors.destructiveForeground};
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid ${colors.border};
          font-size: 12px;
          color: ${colors.mutedForeground};
          text-align: center;
        }
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 100%;
            margin: 0;
            padding: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="company-info">
            ${logoHTML}
            <h1>${resolvedCompanyName}</h1>
            <p style="color: ${colors.mutedForeground};">Billing & Payments</p>
          </div>
          <div class="invoice-info">
            <h2>INVOICE</h2>
            <p style="font-size: 18px; color: ${colors.primary}; font-weight: 600;">${invoiceData.invoiceNumber}</p>
          </div>
        </div>

        <div class="invoice-meta">
          <div class="invoice-meta-item">
            <span class="invoice-meta-label">Invoice Date</span>
            <span class="invoice-meta-value">${formattedDate}</span>
          </div>
          <div class="invoice-meta-item">
            <span class="invoice-meta-label">Invoice Status</span>
            <span class="invoice-meta-value" style="text-transform: capitalize;">${invoiceData.status}</span>
          </div>
          ${invoiceData.dueDate ? `
          <div class="invoice-meta-item">
            <span class="invoice-meta-label">Due Date</span>
            <span class="invoice-meta-value">${invoiceData.dueDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}</span>
          </div>
          ` : ''}
          ${invoiceData.userId ? `
          <div class="invoice-meta-item">
            <span class="invoice-meta-label">User ID</span>
            <span class="invoice-meta-value" style="font-family: monospace; font-size: 14px;">${invoiceData.userId}</span>
          </div>
          ` : ''}
          <div class="invoice-meta-item">
            <span class="invoice-meta-label">Organization ID</span>
            <span class="invoice-meta-value" style="font-family: monospace; font-size: 14px;">${invoiceData.organizationId}</span>
          </div>
        </div>

  ${invoiceData.title ? `<h3 style="margin-bottom: 20px; color: ${colors.cardForeground};">${invoiceData.title}</h3>` : ''}
  ${invoiceData.description ? `<p style="margin-bottom: 30px; color: ${colors.mutedForeground};">${invoiceData.description}</p>` : ''}

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: center;">Quantity</th>
              <th style="text-align: right;">Unit Price</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-section">
            <div class="totals-row">
              <span>Subtotal:</span>
              <span>$${invoiceData.subtotal.toFixed(2)}</span>
            </div>
            ${invoiceData.tax > 0 ? `
            <div class="totals-row">
              <span>Tax:</span>
              <span>$${invoiceData.tax.toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="totals-row total">
              <span>Total:</span>
              <span>${invoiceData.currency} $${invoiceData.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div style="text-align: right;">
          <span class="status-badge ${invoiceData.status}">${invoiceData.status.toUpperCase()}</span>
        </div>

        <div class="footer">
          <p style="margin: 10px 0; color: ${colors.cardForeground};">Thank you for your business with ${resolvedCompanyName}</p>
          <p style="margin: 10px 0; color: ${colors.mutedForeground};">This is an automated invoice. Please retain this document for your records.</p>
          <p style="margin: 10px 0; color: ${colors.mutedForeground};">Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} UTC</p>
        </div>
      </div>
    </body>
    </html>
    `;

    return html;
  }

  /**
   * Create and store an invoice
   */
  static async createInvoice(
    organizationId: string,
    invoiceNumber: string,
    htmlContent: string,
    data: Record<string, unknown>,
    totalAmount: number,
    currency: string = 'USD'
  ): Promise<string> {
    try {
      await this.ensureInvoiceTable();

      const result = await query(
        `INSERT INTO billing_invoices (
          organization_id, 
          invoice_number, 
          html_content, 
          data, 
          total_amount, 
          currency
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [organizationId, invoiceNumber, htmlContent, JSON.stringify(data), totalAmount, currency]
      );

      return result.rows[0].id;
    } catch (error) {
      console.error('Failed to create invoice:', error);
      throw error;
    }
  }

  /**
   * Get invoice by ID
   */
  static async getInvoice(invoiceId: string, organizationId: string) {
    try {
      await this.ensureInvoiceTable();

      const result = await query(
        `SELECT 
          id, 
          organization_id, 
          invoice_number, 
          html_content, 
          data, 
          total_amount, 
          currency, 
          created_at, 
          updated_at
        FROM billing_invoices
        WHERE id = $1 AND organization_id = $2`,
        [invoiceId, organizationId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        organizationId: row.organization_id,
        invoiceNumber: row.invoice_number,
        htmlContent: row.html_content,
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
        totalAmount: parseFloat(row.total_amount),
        currency: row.currency,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      console.error('Failed to get invoice:', error);
      return null;
    }
  }

  /**
   * List invoices for organization
   */
  static async listInvoices(organizationId: string, limit: number = 50, offset: number = 0) {
    try {
      await this.ensureInvoiceTable();

      const result = await query(
        `SELECT 
          id, 
          organization_id, 
          invoice_number, 
          total_amount, 
          currency, 
          created_at
        FROM billing_invoices
        WHERE organization_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
        [organizationId, limit, offset]
      );

      return result.rows.map(row => ({
        id: row.id,
        organizationId: row.organization_id,
        invoiceNumber: row.invoice_number,
        totalAmount: parseFloat(row.total_amount),
        currency: row.currency,
        createdAt: row.created_at,
      }));
    } catch (error) {
      console.error('Failed to list invoices:', error);
      return [];
    }
  }

  /**
   * Generate invoice from VPS billing cycles with itemized backup costs
   */
  static generateInvoiceFromBillingCycles(
    organizationId: string,
    billingCycles: Array<{
      vpsLabel: string;
      billingPeriodStart: Date;
      billingPeriodEnd: Date;
      hoursCharged: number;
      baseHourlyRate: number;
      backupHourlyRate: number;
      backupFrequency: string;
      totalAmount: number;
    }>,
    invoiceNumber: string,
    currency: string = 'USD',
    userId?: string
  ): InvoiceData {
    const items: InvoiceItem[] = [];

    // Group billing cycles by VPS and create separate line items for base and backup costs
    billingCycles.forEach(cycle => {
      const baseAmount = cycle.baseHourlyRate * cycle.hoursCharged;

      // Add base VPS cost line item
      items.push({
        description: `${cycle.vpsLabel} - VPS Service (${cycle.hoursCharged}h)`,
        quantity: cycle.hoursCharged,
        unitPrice: cycle.baseHourlyRate,
        amount: baseAmount,
      });

      // Add backup cost line item if backups are enabled
      if (cycle.backupHourlyRate > 0 && cycle.backupFrequency !== 'none') {
        const backupAmount = cycle.backupHourlyRate * cycle.hoursCharged;
        const frequencyLabel = cycle.backupFrequency === 'daily' ? 'Daily' : 'Weekly';

        items.push({
          description: `${cycle.vpsLabel} - ${frequencyLabel} Backups (${cycle.hoursCharged}h)`,
          quantity: cycle.hoursCharged,
          unitPrice: cycle.backupHourlyRate,
          amount: backupAmount,
        });
      }
    });

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const tax = 0;
    const total = subtotal + tax;

    const periodStart = billingCycles.length > 0
      ? billingCycles[billingCycles.length - 1].billingPeriodStart
      : new Date();
    const periodEnd = billingCycles.length > 0
      ? billingCycles[0].billingPeriodEnd
      : new Date();

    return {
      id: `inv-${Date.now()}`,
      invoiceNumber,
      organizationId,
      userId,
      title: 'VPS Billing Statement',
      description: `Hourly VPS billing from ${periodStart.toLocaleDateString()} to ${periodEnd.toLocaleDateString()}`,
      items,
      subtotal,
      tax,
      total,
      currency,
      createdAt: new Date(),
      status: 'issued',
    };
  }

  /**
   * Generate invoice from payment transactions
   */
  static generateInvoiceFromTransactions(
    organizationId: string,
    transactions: Array<{ description?: string; amount: string | number; currency?: string; createdAt?: string }>,
    invoiceNumber: string,
    userId?: string
  ): InvoiceData {
    const detectedCurrency = transactions.find(
      tx => typeof tx.currency === 'string' && tx.currency.trim().length > 0
    )?.currency || 'USD';
    const currency = detectedCurrency.toUpperCase();

    const items: InvoiceItem[] = transactions.map(tx => {
      const amountRaw = typeof tx.amount === 'string' ? parseFloat(tx.amount) : Number(tx.amount ?? 0);
      const amount = Number.isFinite(amountRaw) ? amountRaw : 0;
      return {
        description: tx.description || 'Wallet transaction',
        quantity: 1,
        unitPrice: amount,
        amount,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const tax = 0; // No tax for wallet adjustments
    const total = subtotal + tax;

    return {
      id: `inv-${Date.now()}`,
      invoiceNumber,
      organizationId,
      userId,
      title: 'Billing Statement',
      description: `Payment transactions from ${transactions[transactions.length - 1]?.createdAt || 'unknown'} to ${transactions[0]?.createdAt || 'unknown'}`,
      items,
      subtotal,
      tax,
      total,
      currency,
      createdAt: new Date(),
      status: 'issued',
    };
  }
}
