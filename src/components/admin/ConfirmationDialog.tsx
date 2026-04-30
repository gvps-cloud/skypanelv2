/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive' | 'warning' | 'success';
  isLoading?: boolean;
}

const variantConfig = {
  default: {
    icon: Info,
    iconClass: 'text-blue-500',
    confirmClass: 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500',
  },
  destructive: {
    icon: XCircle,
    iconClass: 'text-red-500',
    confirmClass: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-amber-500',
    confirmClass: 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500',
  },
  success: {
    icon: CheckCircle,
    iconClass: 'text-green-500',
    confirmClass: 'bg-green-600 hover:bg-green-700 focus-visible:ring-green-500',
  },
};

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  isLoading = false,
}) => {
  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className={cn(
        "animate-in fade-in-0 zoom-in-95 duration-200",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
      )}>
        <AlertDialogHeader className="animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full",
              variant === 'destructive' && "bg-red-100 dark:bg-red-900/20",
              variant === 'warning' && "bg-amber-100 dark:bg-amber-900/20",
              variant === 'success' && "bg-green-100 dark:bg-green-900/20",
              variant === 'default' && "bg-blue-100 dark:bg-blue-900/20"
            )}>
              <Icon className={cn("h-5 w-5", config.iconClass)} />
            </div>
            <AlertDialogTitle className="text-lg font-semibold">
              {title}
            </AlertDialogTitle>
          </div>
        </AlertDialogHeader>
        
        <AlertDialogDescription className={cn(
          "text-sm text-muted-foreground leading-relaxed",
          "animate-in slide-in-from-bottom-2 duration-300 delay-100"
        )}>
          {description}
        </AlertDialogDescription>
        
        <AlertDialogFooter className={cn(
          "flex gap-2 pt-4",
          "animate-in slide-in-from-bottom-2 duration-300 delay-200"
        )}>
          <AlertDialogCancel asChild>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className={cn(
                "transition-all duration-200 hover:scale-105",
                "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isLoading && "opacity-50 cursor-not-allowed hover:scale-100"
              )}
            >
              {cancelText}
            </Button>
          </AlertDialogCancel>
          
          <AlertDialogAction asChild>
            <Button
              onClick={handleConfirm}
              disabled={isLoading}
              className={cn(
                "transition-all duration-200 hover:scale-105",
                "focus-visible:ring-2 focus-visible:ring-offset-2",
                config.confirmClass,
                isLoading && "opacity-75 cursor-not-allowed hover:scale-100"
              )}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>Processing...</span>
                </div>
              ) : (
                confirmText
              )}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const useConfirmationDialog = () => {
  const [dialogState, setDialogState] = React.useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: 'default' | 'destructive' | 'warning' | 'success';
    confirmText?: string;
    cancelText?: string;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const showConfirmation = React.useCallback((config: {
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: 'default' | 'destructive' | 'warning' | 'success';
    confirmText?: string;
    cancelText?: string;
  }) => {
    setDialogState({
      ...config,
      isOpen: true,
    });
  }, []);

  const hideConfirmation = React.useCallback(() => {
    setDialogState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const ConfirmationDialogComponent = React.useCallback(() => (
    <ConfirmationDialog
      isOpen={dialogState.isOpen}
      onClose={hideConfirmation}
      onConfirm={dialogState.onConfirm}
      title={dialogState.title}
      description={dialogState.description}
      variant={dialogState.variant}
      confirmText={dialogState.confirmText}
      cancelText={dialogState.cancelText}
    />
  ), [dialogState, hideConfirmation]);

  return {
    showConfirmation,
    hideConfirmation,
    ConfirmationDialog: ConfirmationDialogComponent,
  };
};