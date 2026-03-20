/**
 * Egress Credit Manager Component
 * Admin interface for managing organization egress credits
 */
import React, { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Database,
  Plus,
  Search,
  RefreshCw,
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  Building2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
}

interface EgressBalanceData {
  organizationId: string;
  organizationName: string;
  ownerId: string;
  creditsGb: number;
  warning: boolean;
  purchaseHistory: CreditPurchase[];
}

interface CreditPurchase {
  id: string;
  organizationId: string;
  packId: string;
  creditsGb: number;
  amountPaid: number;
  paymentTransactionId: string | null;
  createdAt: string;
}

interface AddCreditsDialogProps {
  organization: Organization | null;
  balance: number | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddCreditsDialog: React.FC<AddCreditsDialogProps> = ({
  organization,
  balance,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [creditsGb, setCreditsGb] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organization) return;

    const parsedCredits = parseFloat(creditsGb);
    if (isNaN(parsedCredits) || parsedCredits <= 0) {
      toast.error('Please enter a valid credit amount');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post(`/api/egress/admin/credits/${organization.id}`, {
        credits_gb: parsedCredits,
        reason: reason || 'Admin credit addition',
      });

      if (response.data.success) {
        toast.success(`Added ${parsedCredits}GB credits to ${organization.name}`);
        setCreditsGb('');
        setReason('');
        onClose();
        onSuccess();
      } else {
        toast.error(response.data.error || 'Failed to add credits');
      }
    } catch (error: any) {
      console.error('Failed to add credits:', error);
      toast.error(error.response?.data?.error || 'Failed to add credits');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Egress Credits</DialogTitle>
          <DialogDescription>
            Add pre-paid egress credits to {organization?.name}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="credits">Credits (GB)</Label>
              <Input
                id="credits"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Enter amount in GB"
                value={creditsGb}
                onChange={(e) => setCreditsGb(e.target.value)}
                required
              />
              {balance !== null && (
                <p className="text-xs text-muted-foreground">
                  Current balance: {balance.toFixed(2)} GB
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                placeholder="Reason for adding credits (e.g., support refund, promotional credit)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Credits'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const EgressCreditManager: React.FC = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [balanceData, setBalanceData] = useState<EgressBalanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [historyOrg, setHistoryOrg] = useState<Organization | null>(null);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

  // Search for organizations
  const searchOrganizations = useCallback(async (query: string) => {
    if (!query.trim()) {
      setOrganizations([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await apiClient.get(`/api/admin/organizations?search=${encodeURIComponent(query)}`);
      if (response.data.success && response.data.organizations) {
        setOrganizations(response.data.organizations.slice(0, 10)); // Limit to 10 results
      }
    } catch (error) {
      console.error('Failed to search organizations:', error);
      toast.error('Failed to search organizations');
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Load balance for selected organization
  const loadBalance = useCallback(async (org: Organization) => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/api/egress/admin/credits/${org.id}/balance`);
      if (response.data.success) {
        setBalanceData(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load egress balance:', error);
      toast.error('Failed to load egress balance');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle organization selection
  const handleSelectOrg = (org: Organization) => {
    setSelectedOrg(org);
    loadBalance(org);
  };

  // Format date
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

  // Format GB
  const formatGb = (gb: number) => {
    if (gb >= 1000) {
      return `${(gb / 1000).toFixed(2)} TB`;
    }
    return `${gb.toFixed(2)} GB`;
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Manage Egress Credits
          </CardTitle>
          <CardDescription>
            Search for organizations and manage their pre-paid egress credits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search organizations by name or ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchOrganizations(e.target.value);
                }}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setSearchQuery('');
                setOrganizations([]);
                setSelectedOrg(null);
                setBalanceData(null);
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Search Results */}
          {searchQuery && organizations.length > 0 && (
            <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleSelectOrg(org)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left",
                    selectedOrg?.id === org.id && "bg-muted"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{org.name}</p>
                      <p className="text-xs text-muted-foreground">{org.id}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          {searchQuery && organizations.length === 0 && !searchLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No organizations found matching "{searchQuery}"
            </p>
          )}
        </CardContent>
      </Card>

      {/* Balance Display */}
      {selectedOrg && balanceData && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{balanceData.organizationName}</CardTitle>
                <CardDescription className="mt-1">
                  Owner ID: {balanceData.ownerId}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedOrg(null);
                  setBalanceData(null);
                }}
              >
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Balance Display */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">Egress Credit Balance</p>
                <p className="text-2xl font-bold mt-1">
                  {formatGb(balanceData.creditsGb)}
                </p>
              </div>
              <div className="flex gap-2">
                {balanceData.warning && (
                  <Badge variant="outline" className="border-amber-500 text-amber-700">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Low Balance
                  </Badge>
                )}
                <Button
                  size="sm"
                  onClick={() => {
                    setIsAddDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Credits
                </Button>
              </div>
            </div>

            {/* Purchase History */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Purchase History</h3>
                {balanceData.purchaseHistory.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setHistoryOrg(selectedOrg);
                      setIsHistoryDialogOpen(true);
                    }}
                  >
                    View All
                  </Button>
                )}
              </div>
              {balanceData.purchaseHistory.length > 0 ? (
                <div className="border rounded-lg divide-y">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Pack</TableHead>
                        <TableHead className="text-right">Credits</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balanceData.purchaseHistory.slice(0, 5).map((purchase) => (
                        <TableRow key={purchase.id}>
                          <TableCell className="text-sm">{formatDate(purchase.createdAt)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{purchase.packId}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatGb(purchase.creditsGb)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            ${purchase.amountPaid.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No purchase history
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Credits Dialog */}
      {selectedOrg && (
        <AddCreditsDialog
          organization={selectedOrg}
          balance={balanceData?.creditsGb ?? null}
          isOpen={isAddDialogOpen}
          onClose={() => setIsAddDialogOpen(false)}
          onSuccess={() => {
            loadBalance(selectedOrg);
          }}
        />
      )}

      {/* History Dialog */}
      {historyOrg && (
        <Dialog open={isHistoryDialogOpen} onOpenChange={(open) => !open && setHistoryOrg(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Egress Credit Purchase History</DialogTitle>
              <DialogDescription>
                Complete purchase history for {historyOrg.name}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {balanceData?.purchaseHistory && balanceData.purchaseHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Pack</TableHead>
                      <TableHead className="text-right">Credits</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balanceData.purchaseHistory.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell className="text-sm">{formatDate(purchase.createdAt)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{purchase.packId}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatGb(purchase.creditsGb)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          ${purchase.amountPaid.toFixed(2)}
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
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No purchase history
                </p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setHistoryOrg(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default EgressCreditManager;
