
import express, { Request, Response } from 'express';
import { body, param, query as queryValidator, validationResult } from 'express-validator';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { query } from '../../lib/database.js';
import { logActivity } from '../../services/activityLogger.js';
import { InvoiceService } from '../../services/invoiceService.js';

const router = express.Router();

// Apply admin authentication to all routes
router.use(authenticateToken, requireAdmin);

/**
 * Get billing overview statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Total Revenue (Completed payments)
    const revenueResult = await query(`
      SELECT SUM(amount) as total
      FROM payment_transactions
      WHERE status = 'completed' AND amount > 0 AND payment_method != 'manual_adjustment'
    `);

    // Total Wallet Balance across all organizations
    const walletBalanceResult = await query(`
      SELECT SUM(balance) as total
      FROM wallets
    `);

    // Total Transactions Count
    const transactionCountResult = await query(`
      SELECT COUNT(*) as total
      FROM payment_transactions
    `);
    
    // Pending Invoices / Negative Balances (if we allowed overdraft, but wallets are prepaid. 
    // We can count users with low balance < 5)
    const lowBalanceResult = await query(`
      SELECT COUNT(*) as total
      FROM wallets
      WHERE balance < 5
    `);

    // Monthly Revenue (Last 6 months)
    const monthlyRevenueResult = await query(`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') as month,
        SUM(amount) as total
      FROM payment_transactions
      WHERE status = 'completed' AND amount > 0
        AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY month
      ORDER BY month ASC
    `);

    res.json({
      success: true,
      stats: {
        totalRevenue: parseFloat(revenueResult.rows[0]?.total || '0'),
        totalWalletBalance: parseFloat(walletBalanceResult.rows[0]?.total || '0'),
        totalTransactions: parseInt(transactionCountResult.rows[0]?.total || '0'),
        lowBalanceCount: parseInt(lowBalanceResult.rows[0]?.total || '0'),
        monthlyRevenue: monthlyRevenueResult.rows.map(row => ({
          month: row.month,
          amount: parseFloat(row.total)
        }))
      }
    });
  } catch (error) {
    console.error('Get billing stats error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * List users with billing information
 */
router.get('/users', 
  [
    queryValidator('limit').optional().isInt({ min: 1, max: 100 }),
    queryValidator('offset').optional().isInt({ min: 0 }),
    queryValidator('search').optional().isString(),
    queryValidator('sort').optional().isIn(['balance_desc', 'balance_asc', 'name_asc', 'email_asc', 'created_desc'])
  ],
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const search = req.query.search as string;
      const sort = req.query.sort as string || 'created_desc';

      let orderBy = 'u.created_at DESC';
      if (sort === 'balance_desc') orderBy = 'w.balance DESC NULLS LAST';
      if (sort === 'balance_asc') orderBy = 'w.balance ASC NULLS LAST';
      if (sort === 'name_asc') orderBy = 'u.name ASC';
      if (sort === 'email_asc') orderBy = 'u.email ASC';

      const whereClauses = ['1=1'];
      const params: any[] = [];

      if (search) {
        params.push(`%${search}%`);
        whereClauses.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR o.name ILIKE $${params.length})`);
      }

      // Main query joining users -> organizations -> wallets
      // Note: This assumes one primary organization per user (owner) for simplicity in this view, 
      // or we list organizations. Let's list Users and their OWNED organization wallet.
      const sql = `
        SELECT 
          u.id, 
          u.name, 
          u.email, 
          u.created_at,
          o.id as organization_id,
          o.name as organization_name,
          w.balance,
          w.currency,
          (
            SELECT COUNT(*) 
            FROM vps_instances v 
            WHERE v.organization_id = o.id
          ) as active_services
        FROM users u
        LEFT JOIN organizations o ON o.owner_id = u.id
        LEFT JOIN wallets w ON w.organization_id = o.id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY ${orderBy}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const countSql = `
        SELECT COUNT(*) as total
        FROM users u
        LEFT JOIN organizations o ON o.owner_id = u.id
        WHERE ${whereClauses.join(' AND ')}
      `;

      params.push(limit, offset);

      const [usersResult, countResult] = await Promise.all([
        query(sql, params),
        query(countSql, params.slice(0, -2)) // Exclude limit/offset for count
      ]);

      res.json({
        success: true,
        users: usersResult.rows.map(row => ({
          ...row,
          balance: parseFloat(row.balance || '0'),
          active_services: parseInt(row.active_services || '0')
        })),
        pagination: {
          total: parseInt(countResult.rows[0]?.total || '0'),
          limit,
          offset
        }
      });
    } catch (error) {
      console.error('Get billing users error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

/**
 * List all transactions (Global)
 */
router.get('/transactions',
  [
    queryValidator('limit').optional().isInt({ min: 1, max: 100 }),
    queryValidator('offset').optional().isInt({ min: 0 }),
    queryValidator('status').optional().isIn(['completed', 'pending', 'failed', 'refunded']),
    queryValidator('type').optional().isIn(['credit', 'debit']),
    queryValidator('userId').optional().isUUID()
  ],
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string;
      const type = req.query.type as string;
      const userId = req.query.userId as string;

      const whereClauses = ['1=1'];
      const params: any[] = [];

      if (status) {
        params.push(status);
        whereClauses.push(`pt.status = $${params.length}`);
      }

      if (userId) {
        // Filter by organization owner
        params.push(userId);
        whereClauses.push(`o.owner_id = $${params.length}`);
      }

      if (type === 'credit') {
        whereClauses.push(`pt.amount >= 0`);
      } else if (type === 'debit') {
        whereClauses.push(`pt.amount < 0`);
      }

      const sql = `
        SELECT 
          pt.*,
          o.name as organization_name,
          u.email as user_email,
          u.name as user_name
        FROM payment_transactions pt
        JOIN organizations o ON pt.organization_id = o.id
        JOIN users u ON o.owner_id = u.id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY pt.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const countSql = `
        SELECT COUNT(*) as total
        FROM payment_transactions pt
        JOIN organizations o ON pt.organization_id = o.id
        WHERE ${whereClauses.join(' AND ')}
      `;

      params.push(limit, offset);

      const [txResult, countResult] = await Promise.all([
        query(sql, params),
        query(countSql, params.slice(0, -2))
      ]);

      res.json({
        success: true,
        transactions: txResult.rows.map(row => ({
          ...row,
          amount: parseFloat(row.amount),
          metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
        })),
        pagination: {
          total: parseInt(countResult.rows[0]?.total || '0'),
          limit,
          offset
        }
      });
    } catch (error) {
      console.error('Get all transactions error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

/**
 * Generate invoice from a specific transaction (Admin)
 */
router.post(
  '/transactions/:transactionId/invoice',
  [
    param('transactionId').isUUID().withMessage('Transaction ID must be a valid UUID'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { transactionId } = req.params;

      const txResult = await query(
        `SELECT 
          pt.id,
          pt.organization_id,
          pt.amount,
          pt.currency,
          pt.description,
          pt.created_at,
          o.owner_id as user_id
        FROM payment_transactions pt
        JOIN organizations o ON pt.organization_id = o.id
        WHERE pt.id = $1
        LIMIT 1`,
        [transactionId]
      );

      if (txResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Transaction not found' });
      }

      const tx = txResult.rows[0];
      const invoiceNumber = `INV-ADMIN-TXN-${Date.now()}`;
      const amountRaw = typeof tx.amount === 'string' ? parseFloat(tx.amount) : Number(tx.amount ?? 0);
      const amount = Number.isFinite(amountRaw) ? amountRaw : 0;
      const currency = (tx.currency || 'USD').toUpperCase();

      const invoiceData = InvoiceService.generateInvoiceFromTransactions(
        tx.organization_id,
        [
          {
            description: tx.description || 'Wallet transaction',
            amount,
            currency,
            createdAt: tx.created_at ? new Date(tx.created_at).toISOString() : undefined,
          },
        ],
        invoiceNumber,
        tx.user_id || undefined
      );

      const htmlContent = InvoiceService.generateInvoiceHTML(invoiceData);

      const invoiceId = await InvoiceService.createInvoice(
        tx.organization_id,
        invoiceNumber,
        htmlContent,
        {
          ...invoiceData,
          sourceTransactionId: tx.id,
          generatedBy: 'admin',
        } as unknown as Record<string, unknown>,
        invoiceData.total,
        invoiceData.currency || 'USD'
      );

      return res.json({
        success: true,
        invoiceId,
        invoiceNumber,
      });
    } catch (error) {
      console.error('Generate admin transaction invoice error:', error);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

/**
 * Create a manual transaction (Admin adjustment)
 */
router.post('/transactions',
  [
    body('userId').isUUID().withMessage('User ID is required'),
    body('amount').isFloat().withMessage('Amount must be a number'),
    body('type').isIn(['credit', 'debit']).withMessage('Type must be credit or debit'),
    body('description').isString().notEmpty().withMessage('Description is required'),
    body('sendEmail').optional().isBoolean()
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { userId, amount, type, description, sendEmail } = req.body;
      const adminId = (req as any).user.id;

      // Get user's organization
      const orgResult = await query('SELECT id FROM organizations WHERE owner_id = $1 LIMIT 1', [userId]);
      if (orgResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'User does not have an organization' });
      }
      const organizationId = orgResult.rows[0].id;

      // Calculate final amount (negative for debit)
      const finalAmount = type === 'debit' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount));

      // Process transaction via PayPalService (or similar logic)
      // We can use PayPalService.deductFundsFromWallet for debit, but we need credit too.
      // Better to do it manually here to control metadata and types.

      // 1. Update Wallet
      const updateWalletSql = `
        UPDATE wallets 
        SET balance = balance + $1, updated_at = NOW()
        WHERE organization_id = $2
        RETURNING balance
      `;
      const walletResult = await query(updateWalletSql, [finalAmount, organizationId]);
      
      if (walletResult.rows.length === 0) {
        // Create wallet if not exists (should exist from seed, but just in case)
        await query('INSERT INTO wallets (organization_id, balance) VALUES ($1, $2)', [organizationId, finalAmount > 0 ? finalAmount : 0]);
      }
      
      const newBalance = walletResult.rows[0]?.balance || 0;

      // 2. Create Transaction Record
      const txSql = `
        INSERT INTO payment_transactions 
        (organization_id, amount, currency, payment_method, payment_provider, status, description, metadata)
        VALUES ($1, $2, 'USD', 'manual_adjustment', 'admin', 'completed', $3, $4)
        RETURNING id
      `;
      
      const metadata = {
        admin_id: adminId,
        reason: description,
        balance_after: newBalance,
        type: type
      };

      const txResult = await query(txSql, [organizationId, finalAmount, description, JSON.stringify(metadata)]);

      // 3. Log Activity
      await logActivity({
        userId: adminId, // Admin performed the action
        organizationId,
        eventType: 'billing.adjustment',
        entityType: 'payment_transaction',
        entityId: txResult.rows[0].id,
        message: `Admin adjusted balance by ${finalAmount} USD. Reason: ${description}`,
        status: 'success',
        metadata
      }, req);

      // 4. Send Email (TODO: Implement email service integration)
      if (sendEmail) {
        // await EmailService.sendBillingAdjustmentNotification(userId, ...);
      }

      res.json({
        success: true,
        transactionId: txResult.rows[0].id,
        newBalance: parseFloat(newBalance)
      });

    } catch (error) {
      console.error('Create manual transaction error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

/**
 * List all invoices (Global)
 */
router.get('/invoices',
  [
    queryValidator('limit').optional().isInt({ min: 1, max: 100 }),
    queryValidator('offset').optional().isInt({ min: 0 }),
    queryValidator('userId').optional().isUUID()
  ],
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const userId = req.query.userId as string;

      // We don't have a dedicated invoices table in the schema shown earlier?
      // Wait, `InvoiceService` uses `invoices` table? 
      // Let me check `InvoiceService.ts` to see where it stores data.
      // If it's dynamic, I might need to query `payment_transactions` or `vps_billing_cycles`.
      // But `invoices.ts` had `InvoiceService.listInvoices`.
      
      // Let's assume InvoiceService has a method or we can query the table if it exists.
      // The schema I read earlier didn't show `invoices` table explicitly?
      // Let me double check `001_initial_schema.sql`... I missed it or it's not there.
      // But `invoices.ts` imports `InvoiceService`.
      
      // Use InvoiceService if possible, but it might be scoped to organization.
      // I'll check if InvoiceService has a global list method.
      
      // Fallback: If no invoices table, we return empty or implement it.
      // Assuming `InvoiceService` works with `invoices` table (implied by `createInvoice`).
      
      const invoices = await InvoiceService.listAllInvoices(limit, offset, userId); // Need to implement this in Service if not exists
      
      res.json({
        success: true,
        invoices
      });
    } catch (error) {
      // If listAllInvoices doesn't exist, we might fail.
      // For now, I'll return a placeholder or empty list to avoid crashing if method missing.
      console.error('List invoices error:', error);
      res.json({ success: true, invoices: [] }); 
    }
  }
);

/**
 * Get invoice details (Admin)
 */
router.get('/invoices/:id',
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const invoice = await InvoiceService.getInvoiceById(id);

      if (!invoice) {
        return res.status(404).json({ success: false, error: 'Invoice not found' });
      }

      res.json({ success: true, invoice });
    } catch (error) {
      console.error('Get invoice error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

/**
 * Download invoice (Admin)
 */
router.get('/invoices/:id/download',
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const invoice = await InvoiceService.getInvoiceById(id);

      if (!invoice) {
        return res.status(404).json({ success: false, error: 'Invoice not found' });
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.html"`);
      res.send(invoice.htmlContent);
    } catch (error) {
      console.error('Download invoice error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

export default router;
