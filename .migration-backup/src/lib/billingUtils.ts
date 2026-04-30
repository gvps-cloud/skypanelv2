/**
 * Billing utilities for calculating monthly spent across the application
 */

import { paymentService } from '../services/paymentService';

export interface MonthlySpendResult {
  monthlySpend: number;
  error: string | null;
  hasDiscrepancy: boolean;
  serverValue?: number;
}

/**
 * Robust date parser for transaction createdAt values
 */
const parseDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  try {
    if (/^\d+$/.test(dateString)) {
      const ts = parseInt(dateString, 10);
      return new Date(ts < 10000000000 ? ts * 1000 : ts);
    }
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

/**
 * Calculate monthly spent from wallet transactions with calendar month boundaries
 * This is the same logic used in the Billing page for consistency
 */
export const calculateMonthlySpent = async (billingSummary?: { totalSpentThisMonth?: number }): Promise<MonthlySpendResult> => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const pageSize = 100;
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;
    const maxPages = 20; // safety cap
    let monthlyTotal = 0;
    let foundAny = false;

    while (hasMore && pagesFetched < maxPages) {
      const result = await paymentService.getWalletTransactions(pageSize, offset);
      const pageTxs = result.transactions || [];
      if (pageTxs.length === 0) {
        hasMore = false;
        break;
      }

      // Filter to current month boundaries
      for (const tx of pageTxs) {
        const created = parseDate(tx.createdAt);
        if (!created) continue;
        if (created >= monthStart && created <= monthEnd) {
          foundAny = true;
          const isDebit = tx.type === 'debit' || (typeof tx.amount === 'number' && tx.amount < 0);
          if (isDebit) {
            monthlyTotal += Math.abs(tx.amount || 0);
          }
        }
      }

      hasMore = result.hasMore;
      offset += pageSize;
      pagesFetched += 1;

      // Optimization: if the oldest transaction in this page is before monthStart and API is sorted by date desc,
      // additional pages are unlikely to include current month. We keep going only if hasMore remains true.
    }

    const computedMonthlySpent = Number(monthlyTotal.toFixed(6));
    
    // Compare against server summary if available and flag discrepancies beyond small threshold
    const serverValue = billingSummary?.totalSpentThisMonth;
    let hasDiscrepancy = false;
    if (typeof serverValue === 'number') {
      const diff = Math.abs(serverValue - monthlyTotal);
      const threshold = Math.max(0.01, serverValue * 0.005); // 0.5% or $0.01
      hasDiscrepancy = diff > threshold;
    }

    return {
      monthlySpend: computedMonthlySpent,
      error: !foundAny ? 'No current-month transactions found' : null,
      hasDiscrepancy,
      serverValue
    };
  } catch (err) {
    console.error('Monthly spent calculation error:', err);
    return {
      monthlySpend: 0,
      error: 'Failed to calculate monthly spent',
      hasDiscrepancy: false
    };
  }
};

/**
 * Get monthly spent with fallback to server billing summary
 * Returns the computed value or server value with proper fallback logic
 */
export const getMonthlySpendWithFallback = async (): Promise<number> => {
  try {
    // Try to get billing summary from server first
    let billingSummary;
    try {
      const summaryResult = await paymentService.getBillingSummary();
      if (summaryResult.success && summaryResult.summary) {
        billingSummary = summaryResult.summary;
      }
    } catch (error) {
      // Billing summary might fail due to organization requirements, continue with local calculation
      console.warn('Failed to load billing summary, using local calculation:', error);
    }

    // Calculate monthly spent locally
    const result = await calculateMonthlySpent(billingSummary);
    
    // Use computed value or server value as fallback
    const displayValue = result.monthlySpend ?? billingSummary?.totalSpentThisMonth ?? 0;
    
    return displayValue;
  } catch (error) {
    console.error('Failed to get monthly spent:', error);
    return 0;
  }
};

/**
 * Monthly reset data interface
 */
export interface MonthlyResetData {
  resetDate: Date;
  currentSpend: number;
  daysIntoMonth: number;
  isNewMonth: boolean;
  previousMonthSpend?: number;
}

/**
 * Get monthly reset information for dashboard indicator
 */
export const getMonthlyResetInfo = (): {
  resetDate: Date;
  daysIntoMonth: number;
  daysInMonth: number;
  progressPercent: number;
  isNewMonth: boolean;
} => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Calculate first day of the next month (reset date)
  const resetDate = new Date(currentYear, currentMonth + 1, 1, 0, 0, 0, 0);
  const monthStart = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
  const msPerDay = 1000 * 60 * 60 * 24;

  // Total days in the current month
  const daysInMonth = Math.round((resetDate.getTime() - monthStart.getTime()) / msPerDay);

  // Calculate days into current month (clamped to the number of days in the month)
  const rawDaysIntoMonth = Math.floor((now.getTime() - monthStart.getTime()) / msPerDay) + 1;
  const daysIntoMonth = Math.max(1, Math.min(daysInMonth, rawDaysIntoMonth));

  // Calculate progress percentage through the month
  const progressPercent = Math.min(100, (daysIntoMonth / daysInMonth) * 100);
  
  // Check if it's a new month (first 3 days)
  const isNewMonth = daysIntoMonth <= 3;
  
  return {
    resetDate,
    daysIntoMonth,
    daysInMonth,
    progressPercent,
    isNewMonth
  };
};

/**
 * Format reset date for display
 */
export const formatResetDate = (resetDate: Date): string => {
  return resetDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Get reset indicator text based on current date
 */
export const getResetIndicatorText = (): string => {
  const { resetDate, daysIntoMonth: _daysIntoMonth, isNewMonth } = getMonthlyResetInfo();
  
  if (isNewMonth) {
    return 'Recently reset';
  }
  
  const formattedDate = formatResetDate(resetDate);
  return `Reset on ${formattedDate}`;
};