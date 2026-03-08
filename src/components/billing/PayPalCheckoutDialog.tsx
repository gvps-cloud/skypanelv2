import React from 'react';
import {
  PayPalButtons,
  PayPalScriptProvider,
  type ReactPayPalScriptOptions,
  FUNDING,
} from '@paypal/react-paypal-js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { paymentService, type PayPalClientConfig } from '@/services/paymentService';

interface PayPalCheckoutDialogProps {
  open: boolean;
  amount: number | null;
  description: string;
  onOpenChange: (open: boolean) => void;
  onPaymentSuccess: () => Promise<void> | void;
  onPaymentCancel?: () => void;
  onError?: (message: string) => void;
}

export const PayPalCheckoutDialog: React.FC<PayPalCheckoutDialogProps> = ({
  open,
  amount,
  description,
  onOpenChange,
  onPaymentSuccess,
  onPaymentCancel,
  onError,
}) => {
  const [config, setConfig] = React.useState<PayPalClientConfig | null>(null);
  const [isConfigLoading, setIsConfigLoading] = React.useState(false);
  const [configError, setConfigError] = React.useState<string | null>(null);
  const [buttonError, setButtonError] = React.useState<string | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = React.useState(false);
  const [isCapturing, setIsCapturing] = React.useState(false);

  const paymentCompletedRef = React.useRef(false);
  const createdOrderIdRef = React.useRef<string | null>(null);

  const loadConfig = React.useCallback(async () => {
    setIsConfigLoading(true);
    setConfigError(null);

    try {
      const result = await paymentService.getPayPalConfig();
      if (result.success && result.config) {
        setConfig(result.config);
      } else {
        const message = result.error || 'PayPal configuration is unavailable.';
        setConfigError(message);
        onError?.(message);
      }
    } catch (error) {
      console.error('Failed to load PayPal configuration:', error);
      const message = 'Failed to load PayPal configuration.';
      setConfigError(message);
      onError?.(message);
    } finally {
      setIsConfigLoading(false);
    }
  }, [onError]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    setButtonError(null);

    if (!config && !isConfigLoading && !configError) {
      void loadConfig();
    }
  }, [open, config, isConfigLoading, configError, loadConfig]);

  React.useEffect(() => {
    if (!open) {
      setIsCreatingOrder(false);
      setIsCapturing(false);
      paymentCompletedRef.current = false;
    }
  }, [open]);

  const scriptOptions = React.useMemo<ReactPayPalScriptOptions | null>(() => {
    if (!config) {
      return null;
    }

    const options: ReactPayPalScriptOptions = {
      clientId: config.clientId,
      'client-id': config.clientId,
      currency: config.currency,
      intent: config.intent,
      components: 'buttons',
      'disable-funding': config.disableFunding?.join(',') || undefined,
      'data-sdk-integration-source': 'skypanelv2_checkout',
    };

    return options;
  }, [config]);

  const formattedAmount = React.useMemo(() => {
    if (amount === null || Number.isNaN(amount)) {
      return '$0.00';
    }

    const currencyCode = config?.currency ?? 'USD';

    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
      }).format(amount);
    } catch (error) {
      console.error('Failed to format currency amount:', error);
      return `$${amount.toFixed(2)}`;
    }
  }, [amount, config?.currency]);

  const handleDialogOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        const pendingOrderId = createdOrderIdRef.current;
        if (pendingOrderId && !paymentCompletedRef.current) {
          createdOrderIdRef.current = null;
        }

        if (!paymentCompletedRef.current) {
          onPaymentCancel?.();
        }

        paymentCompletedRef.current = false;
        setButtonError(null);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, onPaymentCancel]
  );

  const handleApprove = React.useCallback(
    async (orderId?: string) => {
      if (!orderId) {
        const message = 'Missing PayPal order reference. Please try again.';
        setButtonError(message);
        onError?.(message);
        return;
      }

      setIsCapturing(true);
      setButtonError(null);

      try {
        const result = await paymentService.capturePayment(orderId);

        if (result.success) {
          paymentCompletedRef.current = true;
          createdOrderIdRef.current = null;
          await onPaymentSuccess();
          handleDialogOpenChange(false);
          return;
        }

        const message = result.error || 'Failed to capture PayPal payment.';
        setButtonError(message);
        onError?.(message);
      } catch (error) {
        console.error('PayPal capture error:', error);
        const message = 'Failed to capture PayPal payment.';
        setButtonError(message);
        onError?.(message);
      } finally {
        setIsCapturing(false);
      }
    },
    [handleDialogOpenChange, onError, onPaymentSuccess]
  );

  const isButtonDisabled =
    amount === null || amount <= 0 || !config || isCreatingOrder || isCapturing || Boolean(configError);

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-lg" hideCloseButton={isCapturing}>
        <DialogHeader>
          <DialogTitle>Complete PayPal Checkout</DialogTitle>
          <DialogDescription>
            Confirm your payment of {formattedAmount}. Funds are applied to your wallet as soon as PayPal confirms
            the transaction.
          </DialogDescription>
        </DialogHeader>

        {configError ? (
          <Alert variant="destructive">
            <AlertTitle>PayPal Unavailable</AlertTitle>
            <AlertDescription>{configError}</AlertDescription>
          </Alert>
        ) : null}

        {!config && !configError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading PayPal checkout&hellip;</p>
          </div>
        ) : null}

        {config && scriptOptions ? (
          <div className="space-y-4">
            {buttonError ? (
              <Alert variant="destructive">
                <AlertTitle>Payment Issue</AlertTitle>
                <AlertDescription>{buttonError}</AlertDescription>
              </Alert>
            ) : null}

            <PayPalScriptProvider options={scriptOptions} deferLoading={false}>
              <div className="rounded-md border bg-muted/50 p-4">
                <PayPalButtons
                  fundingSource={FUNDING.PAYPAL}
                  style={{ layout: 'vertical', label: 'pay', tagline: false, shape: 'rect' }}
                  disabled={isButtonDisabled}
                  forceReRender={[amount ?? 0, config.currency]}
                  createOrder={async () => {
                    if (amount === null || amount <= 0) {
                      const message = 'Enter a valid amount before continuing.';
                      setButtonError(message);
                      onError?.(message);
                      throw new Error(message);
                    }

                    setIsCreatingOrder(true);
                    setButtonError(null);

                    try {
                      const result = await paymentService.createPayment({
                        amount,
                        currency: config.currency,
                        description,
                      });

                      if (result.success && result.paymentId) {
                        createdOrderIdRef.current = result.paymentId;
                        return result.paymentId;
                      }

                      const message = result.error || 'Failed to create PayPal order.';
                      setButtonError(message);
                      onError?.(message);
                      throw new Error(message);
                    } finally {
                      setIsCreatingOrder(false);
                    }
                  }}
                  onApprove={async (data) => {
                    await handleApprove(data.orderID);
                  }}
                  onCancel={(data) => {
                    const orderIdCandidate = data?.orderID ?? createdOrderIdRef.current;
                    const orderId = typeof orderIdCandidate === 'string' ? orderIdCandidate : null;
                    if (orderId) {
                      createdOrderIdRef.current = null;
                    }
                    setButtonError('PayPal checkout was cancelled. You can try again when ready.');
                    onPaymentCancel?.();
                  }}
                  onError={(err) => {
                    console.error('PayPal button encountered an error:', err);
                    const message = 'An unexpected PayPal error occurred. Please try again.';
                    setButtonError(message);
                    onError?.(message);
                  }}
                />
              </div>
            </PayPalScriptProvider>
          </div>
        ) : null}

        <DialogFooter className="pt-4">
          <Button
            variant="outline"
            onClick={() => handleDialogOpenChange(false)}
            disabled={isCapturing}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PayPalCheckoutDialog;
