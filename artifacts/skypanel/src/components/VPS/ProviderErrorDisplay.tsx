/**
 * Provider Error Display Component
 * Displays provider-specific errors with helpful messages and retry options
 */

import React from 'react';
import { AlertTriangle, RefreshCw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatErrorDisplay } from '@/lib/providerErrors';

interface ProviderErrorDisplayProps {
  error: any;
  provider?: string;
  onRetry?: () => void;
  className?: string;
}

export const ProviderErrorDisplay: React.FC<ProviderErrorDisplayProps> = ({
  error,
  provider,
  onRetry,
  className = ''
}) => {
  if (!error) return null;

  const { message, suggestion, isRetryable } = formatErrorDisplay(error, provider);

  return (
    <div className={`rounded-lg border border-destructive/50 bg-destructive/10 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium text-destructive">{message}</p>
          
          {suggestion && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <p>{suggestion}</p>
            </div>
          )}
          
          {isRetryable && onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-2"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
