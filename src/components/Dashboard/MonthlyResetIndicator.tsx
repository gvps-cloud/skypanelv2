/**
 * MonthlyResetIndicator Component
 * Displays monthly reset information for the dashboard spending card
 */

import React from "react";
import { Calendar, RotateCcw } from "lucide-react";
import { Badge } from "../ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import {
  getMonthlyResetInfo,
  getResetIndicatorText,
} from "../../lib/billingUtils";
import { cn } from "../../lib/utils";

interface MonthlyResetIndicatorProps {
  monthlySpend: number;
  showAnimation?: boolean;
  className?: string;
}

export const MonthlyResetIndicator: React.FC<MonthlyResetIndicatorProps> = ({
  monthlySpend,
  showAnimation = false,
  className,
}) => {
  const { resetDate, daysIntoMonth, daysInMonth, progressPercent, isNewMonth } =
    getMonthlyResetInfo();
  const indicatorText = getResetIndicatorText();

  // Determine if we should show the "new month" animation
  const showNewMonthAnimation = showAnimation && isNewMonth;

  // Create tooltip content
  const tooltipContent = `Monthly spending resets on the 1st of each month. Next reset: ${resetDate.toLocaleDateString(
    "en-US",
    {
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  )}. Currently day ${daysIntoMonth} of ${daysInMonth}.`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex flex-col items-start gap-3 sm:items-end sm:text-right",
              className,
            )}
            role="status"
            aria-label={tooltipContent}
          >
            <Badge
              variant="secondary"
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 text-xs self-start sm:self-end",
                "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300",
                "border-blue-200 dark:border-blue-800",
                "transition-all duration-300 ease-in-out",
                showNewMonthAnimation && "animate-pulse",
              )}
            >
              {isNewMonth ? (
                <RotateCcw
                  className={cn(
                    "h-3 w-3",
                    showNewMonthAnimation && "animate-spin",
                  )}
                  aria-hidden="true"
                />
              ) : (
                <Calendar className="h-3 w-3" aria-hidden="true" />
              )}
              <span className="font-medium">{indicatorText}</span>
            </Badge>

            {/* Progress indicator showing days into month */}
            <div className="flex w-full flex-col items-start gap-1 text-xs text-muted-foreground sm:items-end">
              <span className="whitespace-nowrap font-medium">
                Day {daysIntoMonth} of {daysInMonth}
              </span>
              <div className="h-1 w-full max-w-[7rem] overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full bg-blue-500 transition-all duration-500 ease-out",
                    isNewMonth && "bg-green-500",
                  )}
                  style={{
                    width: `${progressPercent}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-xs space-y-1">
            <div className="font-medium">Monthly Billing Cycle</div>
            <div>{tooltipContent}</div>
            {monthlySpend > 0 && (
              <div className="text-muted-foreground">
                Current month spending: ${monthlySpend.toFixed(2)}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/**
 * Compact version for smaller spaces
 */
export const MonthlyResetIndicatorCompact: React.FC<
  Omit<MonthlyResetIndicatorProps, "showAnimation">
> = ({ monthlySpend: _monthlySpend, className }) => {
  const { isNewMonth } = getMonthlyResetInfo();
  const indicatorText = getResetIndicatorText();

  return (
    <Badge
      variant="secondary"
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 text-xs",
        "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300",
        "border-blue-200 dark:border-blue-800",
        className,
      )}
    >
      {isNewMonth ? (
        <RotateCcw className="h-3 w-3" aria-hidden="true" />
      ) : (
        <Calendar className="h-3 w-3" aria-hidden="true" />
      )}
      <span className="font-medium">{indicatorText}</span>
    </Badge>
  );
};
