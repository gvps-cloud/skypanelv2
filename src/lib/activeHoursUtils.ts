/**
 * Enhanced Active Hours utilities for VPS instances
 * Provides color coding, formatting, and urgency levels
 */

export interface EnhancedActiveHours {
  hours: number;
  formatted: string;
  colorClass: string;
  urgencyLevel: 'low' | 'medium' | 'high';
  estimatedCost?: number;
}

/**
 * Calculate active hours from creation timestamp
 */
export const calculateActiveHours = (created: string | null | undefined): number => {
  if (!created) return NaN;
  const createdTime = new Date(created).getTime();
  if (!Number.isFinite(createdTime)) return NaN;
  const hours = (Date.now() - createdTime) / 36e5; // 36e5 = 60*60*1000
  return Math.max(0, hours);
};

/**
 * Enhanced active hours calculation with formatting and color coding
 */
export const calculateActiveHoursEnhanced = (
  createdAt: string | null, 
  hourlyRate?: number
): EnhancedActiveHours => {
  const hours = calculateActiveHours(createdAt);
  
  if (!Number.isFinite(hours)) {
    return {
      hours: 0,
      formatted: '—',
      colorClass: 'text-muted-foreground',
      urgencyLevel: 'low'
    };
  }

  // Format hours to 1 decimal place
  const formatted = hours.toLocaleString('en-US', { 
    minimumFractionDigits: 1, 
    maximumFractionDigits: 1 
  });

  // Determine urgency level and color class based on hours
  let urgencyLevel: 'low' | 'medium' | 'high';
  let colorClass: string;

  if (hours < 24) {
    urgencyLevel = 'low';
    colorClass = 'text-primary bg-primary/10 dark:bg-primary/20';
  } else if (hours < 168) { // 1 week
    urgencyLevel = 'medium';
    colorClass = 'text-primary bg-primary/10 dark:bg-primary/20';
  } else {
    urgencyLevel = 'high';
    colorClass = 'text-primary bg-primary/10 dark:bg-primary/20';
  }

  // Calculate estimated cost if hourly rate is provided
  const estimatedCost = hourlyRate ? hours * hourlyRate : undefined;

  return {
    hours,
    formatted,
    colorClass,
    urgencyLevel,
    estimatedCost
  };
};

/**
 * Get tooltip content for active hours display
 */
export const getActiveHoursTooltip = (
  createdAt: string | null,
  estimatedCost?: number
): string => {
  if (!createdAt) return 'No creation date available';
  
  const creationDate = new Date(createdAt);
  if (isNaN(creationDate.getTime())) return 'Invalid creation date';
  
  const formattedDate = creationDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  let tooltip = `Created: ${formattedDate}`;
  
  if (estimatedCost !== undefined) {
    tooltip += `\nEstimated cost: $${estimatedCost.toFixed(4)}`;
  }
  
  return tooltip;
};

/**
 * Format active hours for display in different contexts
 */
export const formatActiveHours = (hours: number, context: 'table' | 'detail' | 'mobile' = 'table'): string => {
  if (!Number.isFinite(hours)) return '—';
  
  switch (context) {
    case 'detail':
      // More detailed format for detail pages
      if (hours < 1) {
        const minutes = Math.floor(hours * 60);
        return `${minutes}m`;
      } else if (hours < 24) {
        return `${hours.toFixed(1)}h`;
      } else {
        const days = Math.floor(hours / 24);
        const remainingHours = Math.floor(hours % 24);
        return `${days}d ${remainingHours}h`;
      }
    case 'mobile':
      // Compact format for mobile
      if (hours < 24) {
        return `${hours.toFixed(1)}h`;
      } else {
        const days = Math.floor(hours / 24);
        return `${days}d`;
      }
    case 'table':
    default:
      // Standard format for tables
      return hours.toLocaleString('en-US', { 
        minimumFractionDigits: 1, 
        maximumFractionDigits: 1 
      });
  }
};