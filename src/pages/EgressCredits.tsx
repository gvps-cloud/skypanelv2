/**
 * Egress Credits Page Component
 * Handles pre-paid egress credit management for VPS network transfer
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Database,
  Plus,
  ShoppingCart,
  AlertTriangle,
  Info,
  Calendar,
  Loader2,
  CheckCircle2,
  CreditCard,
  Star,
  ThumbsUp,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { type OrganizationResources } from '@/types/organizations';
import { egressService, type EgressCreditBalance, type CreditPack, type CreditPurchase } from '../services/egressService';
import PurchaseEgressCreditsDialog from '@/components/billing/PurchaseEgressCreditsDialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const EgressCredits: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  const routerOrgId = (location.state as { organizationId?: string })?.organizationId;

  // Accessible orgs with egress_view permission
  const [accessibleOrgs, setAccessibleOrgs] = useState<OrganizationResources[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);

  // Selected org — defaults to router state org, then user's current org, then first accessible org
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>(undefined);
  const selectedOrg = accessibleOrgs.find(o => o.organization_id === selectedOrgId);
  const selectedOrgName = selectedOrg?.organization_name;
  const canManageEgress = selectedOrg?.permissions?.egress_manage === true;

  const [balance, setBalance] = useState<EgressCreditBalance | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<CreditPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPack, setSelectedPack] = useState<CreditPack | null>(null);

  // Load accessible organizations
  const loadAccessibleOrgs = useCallback(async () => {
    setOrgsLoading(true);
    try {
      const data = await apiClient.get<{ resources: OrganizationResources[] }>('/organizations/resources');
      const orgsWithEgress = (data.resources || []).filter(
        (org: OrganizationResources) => org.permissions?.egress_view === true
      );
      setAccessibleOrgs(orgsWithEgress);

      // Set initial selected org: router state > user's current org > first accessible org
      if (!selectedOrgId) {
        const defaultOrg =
          routerOrgId && orgsWithEgress.some(o => o.organization_id === routerOrgId)
            ? routerOrgId
            : user?.organizationId && orgsWithEgress.some(o => o.organization_id === user.organizationId)
            ? user.organizationId
            : orgsWithEgress[0]?.organization_id;
        setSelectedOrgId(defaultOrg);
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
      toast.error('Failed to load organizations');
    } finally {
      setOrgsLoading(false);
    }
  }, [routerOrgId, user?.organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadAccessibleOrgs();
  }, [loadAccessibleOrgs]);

  // Load balance, packs, purchase history, and wallet balance for selected org
  useEffect(() => {
    if (!selectedOrgId) return;
    void loadBalance();
    void loadPacks();
    void loadPurchaseHistory();
    void loadWalletBalance();
  }, [selectedOrgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadBalance = async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    try {
      const result = await egressService.getOrganizationEgressCredits(selectedOrgId, 20);
      if (result.success && result.data) {
        if ('creditsGb' in result.data) {
          setBalance(result.data as EgressCreditBalance);
        } else {
          const orgData = result.data as { creditsGb: number; warning: boolean };
          setBalance({ creditsGb: orgData.creditsGb, warning: orgData.warning });
        }
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
    if (!selectedOrgId) return;
    try {
      const result = await egressService.getOrganizationCreditPacks(selectedOrgId);
      if (result.success && result.data) {
        setPacks(result.data);
      }
    } catch (error) {
      console.error('Failed to load packs:', error);
    }
  };

  const loadPurchaseHistory = async () => {
    if (!selectedOrgId) return;
    setHistoryLoading(true);
    try {
      const result = await egressService.getOrganizationEgressCredits(selectedOrgId, 20);
      if (result.success && result.data) {
        if ('purchaseHistory' in result.data) {
          setPurchaseHistory(result.data.purchaseHistory || []);
        } else {
          setPurchaseHistory([]);
        }
      }
    } catch (error) {
      console.error('Failed to load purchase history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadWalletBalance = async () => {
    if (!selectedOrgId) return;
    try {
      const result = await egressService.getWalletBalance(selectedOrgId);
      if (result.success && result.data) {
        setWalletBalance(result.data.balance);
      }
    } catch (error) {
      console.error('Failed to load wallet balance:', error);
    }
  };

  const handleOrgChange = (newOrgId: string) => {
    setSelectedOrgId(newOrgId);
    setPurchaseHistory([]);
    setBalance(null);
    setWalletBalance(0);
  };

  const handlePurchaseClick = (pack: CreditPack) => {
    if (!canManageEgress) {
      toast.error('You do not have permission to purchase credits for this organization.');
      return;
    }
    setSelectedPack(pack);
    setIsDialogOpen(true);
  };

  const handlePurchaseSuccess = async () => {
    await loadBalance();
    await loadPurchaseHistory();
    await loadWalletBalance();
    setIsDialogOpen(false);
    setSelectedPack(null);
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
      const tb = gb / 1000;
      return `${parseFloat(tb.toFixed(6))} TB`;
    }
    return `${parseFloat(gb.toFixed(6))} GB`;
  };

  // Access denied if no orgs with egress_view
  if (!orgsLoading && accessibleOrgs.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Database className="h-8 w-8 text-primary" />
            Egress Credits
          </h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
            <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
            <p className="text-muted-foreground">
              You do not have permission to view egress credits for any organization.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading && !selectedOrgId) {
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Database className="h-8 w-8 text-primary" />
              Egress Credits
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage pre-paid credits for VPS network transfer. Credits are deducted hourly based on usage.
            </p>
          </div>

          {/* Organization Selector */}
          {accessibleOrgs.length > 0 && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select
                value={selectedOrgId}
                onValueChange={handleOrgChange}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {accessibleOrgs.map((org) => (
                    <SelectItem key={org.organization_id} value={org.organization_id}>
                      {org.organization_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
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
          <CardDescription>
            {selectedOrgName ? `Egress credits for ${selectedOrgName}` : 'Your available egress credits for network transfer'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-foreground">
              {balance ? formatGb(balance.creditsGb) : '—'}
            </span>
            <span className="text-muted-foreground">available</span>
          </div>

          {balance && balance.creditsGb > 0 && (
            <div className="mt-4">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    balance.warning ? 'bg-amber-500' : 'bg-green-500'
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
        {!canManageEgress && (
          <div className="mb-4">
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                You need egress purchase permissions to buy credits for this organization.
              </CardContent>
            </Card>
          </div>
        )}
        {packs.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>No credit packs available.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {packs.map((pack) => (
              <Card
                key={pack.id}
                className={`hover:shadow-lg transition-shadow relative overflow-hidden group ${
                  pack.isRecommended ? 'ring-2 ring-green-500 dark:ring-green-400' : ''
                } ${canManageEgress ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
                onClick={() => {
                  if (canManageEgress) handlePurchaseClick(pack);
                }}
              >
                {/* Badges */}
                {(pack.isPopular || pack.isRecommended) && (
                  <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                    {pack.isPopular && (
                      <Badge className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950">
                        <Star className="h-3 w-3 mr-1" />
                        Popular
                      </Badge>
                    )}
                    {pack.isRecommended && (
                      <Badge className="bg-green-500 hover:bg-green-600 text-green-950">
                        <ThumbsUp className="h-3 w-3 mr-1" />
                        Recommended
                      </Badge>
                    )}
                  </div>
                )}
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
                  <Button
                    className="w-full mt-4"
                    size="sm"
                    disabled={!canManageEgress}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Purchase
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Purchase History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Purchase History
          </CardTitle>
          <CardDescription>Recent egress credit purchases for {selectedOrgName || 'this organization'}</CardDescription>
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

      {/* Purchase Dialog */}
      {selectedPack && selectedOrgId && (
        <PurchaseEgressCreditsDialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setSelectedPack(null);
          }}
          pack={selectedPack}
          organizationId={selectedOrgId}
          organizationName={selectedOrgName}
          walletBalance={walletBalance}
          onPurchaseSuccess={handlePurchaseSuccess}
        />
      )}
    </div>
  );
};

export default EgressCredits;
