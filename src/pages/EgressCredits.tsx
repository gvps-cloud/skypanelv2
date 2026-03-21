/**
 * Egress Credits Page Component
 * Handles pre-paid egress credit management for VPS network transfer
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database,
  Plus,
  ShoppingCart,
  AlertTriangle,
  Info,
  TrendingUp,
  Calendar,
  DollarSign,
  Loader2,
  CheckCircle2,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import { egressService, type EgressCreditBalance, type CreditPack, type CreditPurchase } from '../services/egressService';
import PayPalCheckoutDialog from '@/components/billing/PayPalCheckoutDialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const EgressCredits: React.FC = () => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<EgressCreditBalance | null>(null);
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<CreditPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isPayPalDialogOpen, setIsPayPalDialogOpen] = useState(false);
  const [selectedPack, setSelectedPack] = useState<CreditPack | null>(null);

  // Load balance and packs
  useEffect(() => {
    loadBalance();
    loadPacks();
    loadPurchaseHistory();
  }, []);

  const loadBalance = async () => {
    try {
      const result = await egressService.getBalance();
      if (result.success && result.data) {
        setBalance(result.data);
      } else {
        toast.error(result.error || 'Failed to load credit balance');
      }
    } catch (error) {
      console.error('Failed to load balance:', error);
      toast.error('Failed to load credit balance');
    } finally {
      setLoading(false);
    }
  };

  const loadPacks = async () => {
    try {
      const result = await egressService.getCreditPacks();
      if (result.success && result.data) {
        setPacks(result.data);
      }
    } catch (error) {
      console.error('Failed to load packs:', error);
    }
  };

  const loadPurchaseHistory = async () => {
    setHistoryLoading(true);
    try {
      const result = await egressService.getPurchaseHistory(20);
      if (result.success && result.data) {
        setPurchaseHistory(result.data);
      }
    } catch (error) {
      console.error('Failed to load purchase history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handlePurchaseClick = (pack: CreditPack) => {
    setSelectedPack(pack);
    setIsPayPalDialogOpen(true);
  };

  const handlePayPalSuccess = async () => {
    if (!selectedPack) return;

    try {
      // Find the most recent payment transaction that doesn't have a corresponding egress credit purchase
      // This is a bit of a workaround since the PayPal dialog doesn't expose the transaction ID
      const historyResult = await egressService.getPurchaseHistory(5);

      // Get PayPal payment transactions to find the most recent one
      const response = await fetch('/api/payments/history?limit=1', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      const data = await response.json();
      if (data.success && data.payments && data.payments.length > 0) {
        const recentPayment = data.payments[0];

        // Check if this payment already has a corresponding egress credit purchase
        const hasExistingPurchase = historyResult.data?.some(
          p => p.paymentTransactionId === recentPayment.id
        );

        if (!hasExistingPurchase && recentPayment.status === 'completed') {
          const result = await egressService.completePurchase(recentPayment.id, selectedPack.id);
          if (result.success) {
            toast.success(result.message || 'Credits purchased successfully!');
            await loadBalance();
            await loadPurchaseHistory();
          } else {
            toast.error(result.error || 'Failed to complete purchase');
          }
          return;
        }
      }

      // Fallback: just reload balance in case credits were auto-applied
      await loadBalance();
      toast.success('Payment completed! If credits were not applied, please contact support.');
    } catch (error) {
      console.error('Failed to complete purchase:', error);
      toast.error('Payment completed, but credits may need to be applied manually');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatGb = (gb: number) => {
    if (gb >= 1000) {
      return `${(gb / 1000).toFixed(2)} TB`;
    }
    return `${gb.toFixed(2)} GB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Database className="h-8 w-8 text-primary" />
          Egress Credits
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage pre-paid credits for VPS network transfer. Credits are deducted hourly based on usage.
        </p>
      </div>

      {/* Warning Banner */}
      {balance?.warning && (
        <Card className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Low Egress Credits Warning
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                Your egress credit balance is running low. VPS instances may be suspended if credits run out.
                Consider purchasing additional credits to avoid service interruption.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Balance Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Balance
          </CardTitle>
          <CardDescription>Your available egress credits for network transfer</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-foreground">
              {balance ? formatGb(balance.creditsGb) : '0 GB'}
            </span>
            <span className="text-muted-foreground">available</span>
          </div>

          {balance && balance.creditsGb > 0 && (
            <div className="mt-4">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    balance.warning
                      ? 'bg-amber-500'
                      : 'bg-green-500'
                  }`}
                  style={{
                    width: `${Math.min(100, (balance.creditsGb / 1000) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg border border-border bg-muted/60">
            <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              <strong>How it works:</strong> Each VPS instance has a monthly transfer quota (e.g., 1TB included).
              Overage usage beyond the quota deducts from your egress credits. Credits are billed hourly
              to prevent unexpected charges. VPS instances are automatically suspended when credits run out.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Credit Packs */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Purchase Credits
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {packs.map((pack) => (
            <Card
              key={pack.id}
              className="hover:shadow-lg transition-shadow cursor-pointer relative overflow-hidden group"
              onClick={() => handlePurchaseClick(pack)}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="relative">
                <CardTitle className="text-lg">{pack.id}</CardTitle>
                <CardDescription>{formatGb(pack.gb)} of credits</CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">${pack.price.toFixed(2)}</span>
                  <span className="text-gray-500 dark:text-gray-400">USD</span>
                </div>
                <Button className="w-full mt-4" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Purchase
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Purchase History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Purchase History
          </CardTitle>
          <CardDescription>Your recent egress credit purchases</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : purchaseHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No purchase history yet</p>
              <p className="text-sm mt-1">Purchase credit packs to see them here</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Pack</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseHistory.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell>{formatDate(purchase.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{purchase.packId}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${purchase.amountPaid.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatGb(purchase.creditsGb)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Complete
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* PayPal Dialog */}
      {selectedPack && (
        <PayPalCheckoutDialog
          open={isPayPalDialogOpen}
          onOpenChange={(open) => {
            setIsPayPalDialogOpen(open);
            if (!open) setSelectedPack(null);
          }}
          amount={selectedPack.price}
          description={`Egress Credit Pack: ${selectedPack.id} (${formatGb(selectedPack.gb)})`}
          onPaymentSuccess={handlePayPalSuccess}
        />
      )}
    </div>
  );
};

export default EgressCredits;
