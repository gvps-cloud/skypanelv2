import { query } from '../lib/database.js';
import { TransferBillingService } from './transferBillingService.js';
// import { emailService } from './emailService.js';

export class BillingCronService {
  private static intervalId: NodeJS.Timeout | null = null;

  static start() {
    if (this.intervalId) return;
    
    // Check every 24 hours (86400000 ms)
    // For demo purposes, we can't easily show this running, but it's here.
    this.intervalId = setInterval(this.processBillingReminders, 86400000);
    
    console.log('Billing Cron Service started');
  }

  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  static async processBillingReminders() {
    try {
      console.log('Processing billing reminders...');
      await TransferBillingService.syncCurrentMonthUsage();
      
      // Find users with low balance (< $5) and active services
      // We check wallets linked to organizations, and find the owner
      // We only want to notify if they have active services (vps_instances)
      const result = await query(`
        SELECT 
          u.email, 
          u.name, 
          w.balance, 
          w.currency,
          o.name as org_name
        FROM wallets w
        JOIN organizations o ON w.organization_id = o.id
        JOIN users u ON o.owner_id = u.id
        WHERE w.balance < 5.00
          AND EXISTS (SELECT 1 FROM vps_instances v WHERE v.organization_id = o.id AND v.status = 'running')
      `);

      for (const row of result.rows) {
        // In a real implementation, we would check if we already sent a reminder recently
        // to avoid spamming (e.g. check a 'last_reminder_sent_at' column or audit log).
        
        console.log(`[Billing Reminder] Low balance for ${row.email} (${row.balance} ${row.currency}). Active services found.`);
        
        // TODO: Integrate with EmailService
        // await emailService.sendTemplate('low_balance', row.email, {
        //   name: row.name,
        //   balance: row.balance,
        //   currency: row.currency
        // });
      }
      
    } catch (error) {
      console.error('Error processing billing reminders:', error);
    }
  }
}
