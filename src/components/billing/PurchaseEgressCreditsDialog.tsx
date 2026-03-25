import React, { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2, Wallet, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { type CreditPack, egressService } from '@/services/egressService';
import PayPalCheckoutDialog from './PayPalCheckoutDialog';

type PaymentMethod = 'paypal' | 'wallet';

interface PurchaseEgressCreditsDialogProps {
  open: boolean;
  pack: CreditPack | null;
  organizationId: string | undefined;
  organizationName: string | undefined;
  walletBalance: number;
  onOpenChange: (open: boolean) => void;
  onPurchaseSuccess: () => Promise<void> | void;
}

export const PurchaseEgressCreditsDialog: React.FC<PurchaseEgressCreditsDialogProps> = ({
  open,
  pack,
  organizationId,
  organizationName,
  walletBalance,
  onOpenChange,
  onPurchaseSuccess,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wallet');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPayPal, setShowPayPal] = useState(false);
  const [walletBalanceCurrent, setWalletBalanceCurrent] = useState(walletBalance);

  // Refresh wallet balance when dialog opens
  useEffect(() => {
    if (open && organizationId) {
      egressService.getWalletBalance(organizationId).then((result) => {
        if (result.success && result.data) {
          setWalletBalanceCurrent(result.data.balance);
        }
      });
    }
  }, [open, organizationId]);

  const formatGb = (gb: number) => {
    if (gb >= 1000) {
      return `${(gb / 1000).toFixed(2)} TB`;
    }
    return `${gb.toFixed(2)} GB`;
  };

  const insufficientWallet = walletBalanceCurrent < (pack?.price ?? 0);

  const handleConfirm = async () => {
    if (!pack || !organizationId) return;

    if (paymentMethod === 'wallet') {
      if (insufficientWallet) {
        setError(
          `Insufficient wallet balance. Required: $${pack.price.toFixed(2)}, Available: $${walletBalanceCurrent.toFixed(2)}`
        );
        return;
      }

      setIsProcessing(true);
      setError(null);

      try {
        const result = await egressService.purchaseWithWallet(organizationId, pack.id);
        if (result.success) {
          toast.success(
            `Successfully purchased ${formatGb(pack.gb)} of egress credits!`
          );
          await onPurchaseSuccess();
          onOpenChange(false);
        } else {
          setError(result.error || 'Failed to purchase credits');
        }
      } catch (err) {
        console.error('Wallet purchase error:', err);
        setError('An unexpected error occurred');
      } finally {
        setIsProcessing(false);
      }
    } else {
      // PayPal — show PayPal checkout dialog
      setShowPayPal(true);
    }
  };

  const handlePayPalSuccess = async (data?: { orderId?: string }) => {
    if (!pack || !organizationId) return;
    const orderId = data?.orderId;
    if (!orderId) {
      toast.error('PayPal payment reference missing. Please contact support.');
      setShowPayPal(false);
      return;
    }

    try {
      setIsProcessing(true);
      // Complete the purchase via org-scoped API
      const result = await egressService.completeOrganizationPurchase(organizationId, orderId, pack.id);
      if (result.success) {
        toast.success(`Successfully purchased ${formatGb(pack.gb)} of egress credits!`);
        await onPurchaseSuccess();
        setShowPayPal(false);
        onOpenChange(false);
      } else {
        setError(result.error || 'Failed to complete purchase');
        setShowPayPal(false);
      }
    } catch (err) {
      console.error('PayPal complete error:', err);
      setError('An unexpected error occurred');
      setShowPayPal(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayPalCancel = () => {
    setShowPayPal(false);
  };

  // When switching back from PayPal view, reset error state
  const handlePaymentMethodChange = (method: PaymentMethod) => {
    setPaymentMethod(method);
    setError(null);
    setShowPayPal(false);
  };

  const isWalletOptionDisabled = insufficientWallet;

  if (showPayPal && pack && organizationId) {
    return (
      <PayPalCheckoutDialog
        open={open}
        amount={pack.price}
        description={`Egress Credit Pack: ${pack.id} (${formatGb(pack.gb)})`}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setShowPayPal(false);
          onOpenChange(nextOpen);
        }}
        onPaymentSuccess={handlePayPalSuccess}
        onPaymentCancel={handlePayPalCancel}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Purchase Egress Credits</DialogTitle>
          <DialogDescription>
            Select a payment method to purchase this credit pack.
          </DialogDescription>
        </DialogHeader>

        {/* Organization badge */}
        {organizationId && organizationName && (
          <div className="flex items-center">
            <Badge
              variant="outline"
              className="text-xs px-2 py-1 border-primary/30 text-primary bg-primary/5"
            >
              <Building2 className="h-3 w-3 mr-1" />
              {organizationName}
            </Badge>
          </div>
        )}

        {/* Pack info */}
        {pack && (
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{pack.id}</p>
                <p className="text-sm text-muted-foreground">
                  {formatGb(pack.gb)} of egress credits
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-foreground">
                  ${pack.price.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">USD</p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Purchase Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Payment method options */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Pay with:</p>

          {/* Wallet option */}
          <div
            className={`rounded-lg border p-4 cursor-pointer transition-all ${
              paymentMethod === 'wallet'
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border hover:border-primary/50'
            } ${isWalletOptionDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => !isWalletOptionDisabled && handlePaymentMethodChange('wallet')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-full p-2 ${
                    paymentMethod === 'wallet' ? 'bg-primary/20' : 'bg-muted'
                  }`}
                >
                  <Wallet
                    className={`h-4 w-4 ${
                      paymentMethod === 'wallet' ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  />
                </div>
                <div>
                  <p className="font-medium text-foreground">Wallet Balance</p>
                  <p className="text-sm text-muted-foreground">
                    Current balance:{' '}
                    <span className="font-medium text-foreground">
                      ${walletBalanceCurrent.toFixed(2)} USD
                    </span>
                  </p>
                </div>
              </div>
              <div
                className={`w-4 h-4 rounded-full border-2 ${
                  paymentMethod === 'wallet'
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground'
                }`}
              />
            </div>
            {isWalletOptionDisabled && (
              <p className="text-xs text-destructive mt-2">
                Insufficient balance — select PayPal or add funds to wallet
              </p>
            )}
          </div>

          {/* PayPal option */}
          <div
            className={`rounded-lg border p-4 cursor-pointer transition-all ${
              paymentMethod === 'paypal'
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => handlePaymentMethodChange('paypal')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-full p-2 ${
                    paymentMethod === 'paypal' ? 'bg-primary/20' : 'bg-muted'
                  }`}
                >
                  <CreditCard
                    className={`h-4 w-4 ${
                      paymentMethod === 'paypal' ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  />
                </div>
                <div>
                  <p className="font-medium text-foreground">PayPal</p>
                  <p className="text-sm text-muted-foreground">
                    Add funds via PayPal
                  </p>
                </div>
              </div>
              <div
                className={`w-4 h-4 rounded-full border-2 ${
                  paymentMethod === 'paypal'
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground'
                }`}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isProcessing || !pack}>
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>Purchase {pack ? `for $${pack.price.toFixed(2)}` : ''}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PurchaseEgressCreditsDialog;
