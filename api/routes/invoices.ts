/**
 * Invoice Routes for SkyPanelV2
 * Handles invoice listing, viewing, and export
 */

import express, { Request, Response } from 'express';
import { param, query as queryValidator, validationResult } from 'express-validator';
import { authenticateToken, requireOrganization } from '../middleware/auth.js';
import { EgressBillingService } from '../services/egressBillingService.js';
import { InvoiceService } from '../services/invoiceService.js';
import { PayPalService, type WalletTransaction } from '../services/paypalService.js';
import { query } from '../lib/database.js';
import { themeService, resolveThemePalette } from '../services/themeService.js';

const router = express.Router();

const resolveCompanyName = (): string =>
  (process.env['COMPANY-NAME'] && process.env['COMPANY-NAME'].trim())
  || (process.env.COMPANY_NAME && process.env.COMPANY_NAME.trim())
  || (process.env.VITE_COMPANY_NAME && process.env.VITE_COMPANY_NAME.trim())
  || 'SkyPanelV2';

const resolveCompanyLogo = (): string | undefined =>
  (process.env.COMPANY_LOGO_URL && process.env.COMPANY_LOGO_URL.trim())
  || undefined;

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    organizationId: string;
    [key: string]: unknown;
  };
};

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * List invoices for the organization
 */
router.get(
  '/',
  [
    queryValidator('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    queryValidator('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer'),
  ],
  requireOrganization,
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

  const organizationId = (req as AuthenticatedRequest).user.organizationId;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const invoices = await InvoiceService.listInvoices(organizationId, limit, offset);

      res.json({
        success: true,
        invoices,
        pagination: {
          limit,
          offset,
          hasMore: invoices.length === limit,
        },
      });
    } catch (error) {
      console.error('List invoices error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
);

/**
 * Get invoice details and view as HTML
 */
router.get(
  '/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Invoice ID must be a valid UUID'),
  ],
  requireOrganization,
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { id } = req.params;
  const organizationId = (req as AuthenticatedRequest).user.organizationId;

      const invoice = await InvoiceService.getInvoice(id, organizationId);

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: 'Invoice not found',
        });
      }

      // Return JSON with invoice details
      res.json({
        success: true,
        invoice,
      });
    } catch (error) {
      console.error('Get invoice error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
);

/**
 * Download invoice as HTML file
 */
router.get(
  '/:id/download',
  [
    param('id')
      .isUUID()
      .withMessage('Invoice ID must be a valid UUID'),
  ],
  requireOrganization,
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { id } = req.params;
  const organizationId = (req as AuthenticatedRequest).user.organizationId;

      const invoice = await InvoiceService.getInvoice(id, organizationId);

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: 'Invoice not found',
        });
      }

      // Set response headers for HTML download
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="invoice-${invoice.invoiceNumber}.html"`
      );

      // Send HTML content
      res.send(invoice.htmlContent);
    } catch (error) {
      console.error('Download invoice error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
);

/**
 * Create invoice from a single wallet transaction
 */
router.post(
  '/from-transaction/:transactionId',
  [
    param('transactionId')
      .isUUID()
      .withMessage('Transaction ID must be a valid UUID'),
  ],
  requireOrganization,
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

  const organizationId = (req as AuthenticatedRequest).user.organizationId;
      const userId = (req as AuthenticatedRequest).user.id;
      const transactionId = req.params.transactionId;

      // Get the specific transaction
      const result = await query(
        `SELECT id, organization_id, amount, currency, description, status, metadata, created_at
         FROM payment_transactions
         WHERE id = $1 AND organization_id = $2`,
        [transactionId, organizationId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found',
        });
      }

      const transaction = result.rows[0];
      const invoiceNumber = `INV-TXN-${Date.now()}`;

      const amountRaw =
        typeof transaction.amount === 'string'
          ? parseFloat(transaction.amount)
          : Number(transaction.amount ?? 0);
      const amountValue = Number.isFinite(amountRaw) ? amountRaw : 0;
      const currency = transaction.currency || 'USD';

      // Fetch user data for invoice display
      let userName: string | undefined;
      let userEmail: string | undefined;
      try {
        const userResult = await query(
          'SELECT name, email FROM users WHERE id = $1',
          [userId]
        );
        if (userResult.rows.length > 0) {
          userName = userResult.rows[0].name || undefined;
          userEmail = userResult.rows[0].email || undefined;
        }
      } catch (error) {
        console.error('Failed to fetch user data for invoice:', error);
        // Continue with invoice generation without user data
      }

      const invoiceData = InvoiceService.generateInvoiceFromTransactions(
        organizationId,
        [
          {
            description: transaction.description || 'Wallet transaction',
            amount: amountValue,
            currency,
            createdAt: transaction.created_at ? new Date(transaction.created_at).toISOString() : undefined,
          },
        ],
        invoiceNumber,
        userId,
        userName,
        userEmail
      );

      // Generate HTML with organization theme
      const themeConfig = await themeService.getThemeConfig();
      const themePalette = resolveThemePalette(themeConfig);

      const htmlContent = InvoiceService.generateInvoiceHTML(
        invoiceData,
        resolveCompanyName(),
        resolveCompanyLogo(),
        themePalette
      );

      // Store invoice
      const invoiceId = await InvoiceService.createInvoice(
        organizationId,
        invoiceNumber,
        htmlContent,
        invoiceData as unknown as Record<string, unknown>,
        invoiceData.total,
        invoiceData.currency || 'USD'
      );

      res.json({
        success: true,
        invoiceId,
        invoiceNumber,
      });
    } catch (error) {
      console.error('Create invoice from transaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
);

/**
 * Create invoice from payment transactions
 */
router.post(
  '/from-transactions',
  requireOrganization,
  async (req: Request, res: Response) => {
    try {
  const organizationId = (req as AuthenticatedRequest).user.organizationId;
      const userId = (req as AuthenticatedRequest).user.id;
      const invoiceNumber = `INV-${Date.now()}`;

      // Get recent transactions for this organization
      const transactions: WalletTransaction[] = await PayPalService.getWalletTransactions(
        organizationId,
        50,
        0
      );

      if (transactions.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No transactions found to create invoice',
        });
      }

      // Fetch user data for invoice display
      let userName: string | undefined;
      let userEmail: string | undefined;
      try {
        const userResult = await query(
          'SELECT name, email FROM users WHERE id = $1',
          [userId]
        );
        if (userResult.rows.length > 0) {
          userName = userResult.rows[0].name || undefined;
          userEmail = userResult.rows[0].email || undefined;
        }
      } catch (error) {
        console.error('Failed to fetch user data for invoice:', error);
        // Continue with invoice generation without user data
      }

      // Generate invoice data
      const invoiceData = InvoiceService.generateInvoiceFromTransactions(
        organizationId,
        transactions.map((tx) => ({
          description: tx.description,
          amount: tx.amount,
          currency: tx.currency || 'USD',
          createdAt: tx.createdAt,
        })),
        invoiceNumber,
        userId,
        userName,
        userEmail
      );

      // Generate HTML with organization theme
      const themeConfig = await themeService.getThemeConfig();
      const themePalette = resolveThemePalette(themeConfig);

      const htmlContent = InvoiceService.generateInvoiceHTML(
        invoiceData,
        resolveCompanyName(),
        resolveCompanyLogo(),
        themePalette
      );

      // Store invoice
      const invoiceId = await InvoiceService.createInvoice(
        organizationId,
        invoiceNumber,
        htmlContent,
        invoiceData as unknown as Record<string, unknown>,
        invoiceData.total,
        invoiceData.currency || 'USD'
      );

      res.json({
        success: true,
        invoiceId,
        invoiceNumber,
      });
    } catch (error) {
      console.error('Create invoice from transactions error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
);

/**
 * Create invoice from VPS billing cycles with itemized backup costs
 */
router.post(
  '/from-billing-cycles',
  [
    queryValidator('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    queryValidator('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
  ],
  requireOrganization,
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const organizationId = (req as AuthenticatedRequest).user.organizationId;
      const userId = (req as AuthenticatedRequest).user.id;
      const invoiceNumber = `INV-SVC-${Date.now()}`;

      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : new Date();
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [result, egressInvoiceItems] = await Promise.all([
        query(`
          SELECT
            bc.id,
            bc.vps_instance_id,
            bc.billing_period_start,
            bc.billing_period_end,
            bc.total_amount,
            bc.metadata,
            vi.label as vps_label
          FROM vps_billing_cycles bc
          JOIN vps_instances vi ON vi.id = bc.vps_instance_id
          WHERE bc.organization_id = $1
            AND bc.status = 'billed'
            AND bc.created_at >= $2
            AND bc.created_at <= $3
          ORDER BY bc.created_at DESC
        `, [organizationId, startDate, endDate]),
        EgressBillingService.listInvoiceItemsForPeriod(organizationId, startDate, endDate),
      ]);

      if (result.rows.length === 0 && egressInvoiceItems.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No VPS billing cycles or billed egress charges found for the specified period',
        });
      }

      const billingCycles = result.rows.map((row) => {
        const metadata = typeof row.metadata === 'string'
          ? JSON.parse(row.metadata)
          : row.metadata;

        return {
          vpsLabel: row.vps_label || 'Unknown VPS',
          billingPeriodStart: new Date(row.billing_period_start),
          billingPeriodEnd: new Date(row.billing_period_end),
          hoursCharged: metadata.hours_charged || 0,
          baseHourlyRate: metadata.base_hourly_rate || 0,
          backupHourlyRate: metadata.backup_hourly_rate || 0,
          backupFrequency: metadata.backup_frequency || 'none',
          totalAmount: parseFloat(row.total_amount),
        };
      });

      let userName: string | undefined;
      let userEmail: string | undefined;
      try {
        const userResult = await query(
          'SELECT name, email FROM users WHERE id = $1',
          [userId]
        );
        if (userResult.rows.length > 0) {
          userName = userResult.rows[0].name || undefined;
          userEmail = userResult.rows[0].email || undefined;
        }
      } catch (error) {
        console.error('Failed to fetch user data for invoice:', error);
      }

      let organizationName: string | undefined;
      try {
        const orgResult = await query(
          'SELECT name FROM organizations WHERE id = $1',
          [organizationId]
        );
        if (orgResult.rows.length > 0) {
          organizationName = orgResult.rows[0].name || undefined;
        }
      } catch (error) {
        console.error('Failed to fetch organization data for invoice:', error);
      }

      const invoiceData = InvoiceService.generateInvoiceFromBillingCycles(
        organizationId,
        billingCycles,
        invoiceNumber,
        'USD',
        userId,
        userName,
        userEmail,
        organizationName
      );

      if (egressInvoiceItems.length > 0) {
        const egressTotal = egressInvoiceItems.reduce(
          (sum, item) => sum + Number(item.amount || 0),
          0,
        );

        invoiceData.items.push(...egressInvoiceItems);
        invoiceData.subtotal = Number((invoiceData.subtotal + egressTotal).toFixed(4));
        invoiceData.total = Number((invoiceData.subtotal + invoiceData.tax).toFixed(4));
        invoiceData.title =
          billingCycles.length > 0
            ? 'VPS & Egress Billing Statement'
            : 'Egress Billing Statement';
        invoiceData.description =
          billingCycles.length > 0
            ? `${invoiceData.description}. Includes billed egress overage charges posted in the selected period.`
            : `Billed egress overage charges from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
      }

      const themeConfig = await themeService.getThemeConfig();
      const themePalette = resolveThemePalette(themeConfig);

      const htmlContent = InvoiceService.generateInvoiceHTML(
        invoiceData,
        resolveCompanyName(),
        resolveCompanyLogo(),
        themePalette
      );

      const invoiceId = await InvoiceService.createInvoice(
        organizationId,
        invoiceNumber,
        htmlContent,
        {
          ...invoiceData,
          sourceType: 'service_billing',
          includesEgress: egressInvoiceItems.length > 0,
          egressItemCount: egressInvoiceItems.length,
        } as Record<string, unknown>,
        invoiceData.total,
        invoiceData.currency || 'USD'
      );

      res.json({
        success: true,
        invoiceId,
        invoiceNumber,
        itemCount: invoiceData.items.length,
        total: invoiceData.total,
      });
    } catch (error) {
      console.error('Create invoice from billing cycles error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
);

export default router;
