/**
 * ActiveHoursDisplay Component
 * Enhanced display for VPS active hours with clock icon, color coding, and tooltips
 */

import React from 'react';
import { Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { calculateActiveHoursEnhanced, getActiveHoursTooltip, formatActiveHours } from '../../lib/activeHoursUtils';
import { cn } from '../../lib/utils';

interface ActiveHoursDisplayProps {
  createdAt: string | null;
  hourlyRate?: number;
  context?: 'table' | 'detail' | 'mobile';
  showTooltip?: boolean;
  className?: string;
}

export const ActiveHoursDisplay: React.FC<ActiveHoursDisplayProps> = ({
  createdAt,
  hourlyRate,
  context = 'table',
  showTooltip = true,
  className
}) => {
  const activeHoursData = calculateActiveHoursEnhanced(createdAt, hourlyRate);
  const tooltipContent = getActiveHoursTooltip(createdAt, activeHoursData.estimatedCost);
  
  // Base classes for the display
  const baseClasses = cn(
    'inline-flex items-center gap-2 font-medium transition-all duration-200',
    'px-2 py-1 rounded-md',
    activeHoursData.colorClass,
    className
  );

  // Icon size based on context
  const iconSize = context === 'detail' ? 'h-5 w-5' : context === 'mobile' ? 'h-4 w-4' : 'h-4 w-4';
  
  // Text size based on context
  const textSize = context === 'detail' ? 'text-base' : context === 'mobile' ? 'text-sm' : 'text-sm';

  const displayContent = (
    <div 
      className={cn(baseClasses, textSize)}
      role="status"
      aria-label={`Active for ${activeHoursData.formatted} hours since ${createdAt ? new Date(createdAt).toLocaleDateString() : 'unknown'}`}
    >
      <Clock className={cn(iconSize, 'flex-shrink-0')} aria-hidden="true" />
      <span className="font-medium">
        {context === 'detail' 
          ? formatActiveHours(activeHoursData.hours, 'detail')
          : context === 'mobile'
          ? formatActiveHours(activeHoursData.hours, 'mobile')
          : activeHoursData.formatted
        }
      </span>
    </div>
  );

  if (!showTooltip || !createdAt) {
    return displayContent;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {displayContent}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-xs space-y-1">
            {tooltipContent.split('\n').map((line, index) => (
              <div key={index}>{line}</div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/**
 * Compact version for use in tight spaces
 */
export const ActiveHoursCompact: React.FC<Omit<ActiveHoursDisplayProps, 'context'>> = (props) => {
  return <ActiveHoursDisplay {...props} context="mobile" showTooltip={false} />;
};

/**
 * Detailed version for VPS detail pages
 */
export const ActiveHoursDetailed: React.FC<Omit<ActiveHoursDisplayProps, 'context'>> = (props) => {
  return <ActiveHoursDisplay {...props} context="detail" />;
};