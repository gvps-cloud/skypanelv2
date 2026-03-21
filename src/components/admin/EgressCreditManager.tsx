/**
 * Egress Credit Manager Component
 * Admin interface for managing organization egress credits and pack settings
 */
import React, { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Database,
  Plus,
  Minus,
  Search,
  RefreshCw,
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  Building2,
  ChevronRight,
  Settings,
  CreditCard,
  ChevronLeft,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import EgressPackSettings from './EgressPackSettings';

interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface EgressBalanceData {
  organizationId: string;
  organizationName: string;
  ownerId: string;
  creditsGb: number;
  warning: boolean;
  purchaseHistory: CreditPurchase[];
  pagination?: PaginationInfo;
}

interface CreditPurchase {
  id: string;
  organizationId: string;
  packId: string;
  creditsGb: number;
  amountPaid: number;
  paymentTransactionId: string | null;
  createdAt: string;
  adjustmentType: 'purchase' | 'admin_add' | 'admin_remove';
  reason?: string;
}

interface AdjustCreditsDialogProps {
  organization: Organization | null;
  balance: number | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: 'add' | 'remove';
}

const AdjustCreditsDialog: React.FC<AdjustCreditsDialogProps> = ({
  organization,
  balance,
  isOpen,
  onClose,
  onSuccess,
  mode,
}) => {
  const [creditsGb, setCreditsGb] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const isRemove = mode === 'remove';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organization) return;

    const parsedCredits = parseFloat(creditsGb);
    if (isNaN(parsedCredits) || parsedCredits <= 0) {
      toast.error('Please enter a valid credit amount');
      return;
    }

    // Check if trying to remove more than available
    if (isRemove && balance !== null && parsedCredits > balance) {
      toast.error(`Cannot remove ${parsedCredits}GB: organization only has ${balance.toFixed(2)}GB`);
      return;
    }

    setLoading(true);
    try {
      const url = `/api/egress/admin/credits/${organization.id}`;
      const method = isRemove ? 'delete' : 'post';
      const defaultReason = isRemove ? 'Admin credit removal' : 'Admin credit addition';

      const response = await apiClient[method](url, {
        creditsGb: parsedCredits,
        reason: reason || defaultReason,
      });

      if (response.success) {
        toast.success(`${isRemove ? 'Removed' : 'Added'} ${parsedCredits}GB credits ${isRemove ? 'from' : 'to'} ${organization.name}`);
        setCreditsGb('');
        setReason('');
        onClose();
        onSuccess();
      } else {
        toast.error(response.error || `Failed to ${isRemove ? 'remove' : 'add'} credits`);
      }
    } catch (error: any) {
      console.error(`Failed to ${isRemove ? 'remove' : 'add'} credits:`, error);
      toast.error(error.message || `Failed to ${isRemove ? 'remove' : 'add'} credits`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isRemove ? 'Remove' : 'Add'} Egress Credits</DialogTitle>
          <DialogDescription>
            {isRemove ? 'Remove' : 'Add'} pre-paid egress credits {isRemove ? 'from' : 'to'} {organization?.name}
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
                max={isRemove && balance ? balance : undefined}
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
                placeholder={`Reason for ${isRemove ? 'removing' : 'adding'} credits`}
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
            <Button 
              type="submit" 
              disabled={loading}
              variant={isRemove ? 'destructive' : 'default'}
            >
              {loading 
                ? (isRemove ? 'Removing...' : 'Adding...') 
                : (isRemove ? 'Remove Credits' : 'Add Credits')
              }
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
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

  // Search for organizations
  const searchOrganizations = useCallback(async (query: string) => {
    if (!query.trim()) {
      setOrganizations([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await apiClient.get(`/api/admin/organizations?search=${encodeURIComponent(query)}`);
      // apiClient returns data directly, not wrapped in response.data
      if (response && response.success && response.organizations) {
        setOrganizations(response.organizations.slice(0, 10)); // Limit to 10 results
      } else {
        setOrganizations([]);
      }
    } catch (error) {
      console.error('Failed to search organizations:', error);
      toast.error('Failed to search organizations');
      setOrganizations([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Load balance for selected organization
  const loadBalance = useCallback(async (org: Organization, page = 1) => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/api/egress/admin/credits/${org.id}/balance?page=${page}&limit=5`);
      // apiClient returns data directly
      if (response && response.success) {
        setBalanceData(response.data);
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
    loadBalance(org, 1);
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
      <Tabs defaultValue="organizations" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="organizations" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Organization Credits
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Pack Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organizations">
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
            <Card className="mt-6">
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
                      onClick={() => setIsAddDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Credits
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsRemoveDialogOpen(true)}
                      disabled={balanceData.creditsGb <= 0}
                    >
                      <Minus className="h-4 w-4 mr-1" />
                      Remove Credits
                    </Button>
                  </div>
                </div>

                {/* Transaction History */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">
                      Transaction History
                      {balanceData.pagination && ` (${balanceData.pagination.total} total)`}
                    </h3>
                  </div>
                  {balanceData.purchaseHistory.length > 0 ? (
                    <div className="border rounded-lg divide-y">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Credits</TableHead>
                            <TableHead>Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {balanceData.purchaseHistory.map((purchase) => (
                            <TableRow key={purchase.id}>
                              <TableCell className="text-sm">{formatDate(purchase.createdAt)}</TableCell>
                              <TableCell>
                                <Badge 
                                  variant={
                                    purchase.adjustmentType === 'admin_remove' ? 'destructive' :
                                    purchase.adjustmentType === 'admin_add' ? 'default' :
                                    'outline'
                                  }
                                >
                                  {purchase.adjustmentType === 'purchase' && 'Purchase'}
                                  {purchase.adjustmentType === 'admin_add' && 'Admin Add'}
                                  {purchase.adjustmentType === 'admin_remove' && 'Admin Remove'}
                                </Badge>
                              </TableCell>
                              <TableCell className={cn(
                                "text-right text-sm font-medium",
                                purchase.adjustmentType === 'admin_remove' && "text-red-500"
                              )}>
                                {purchase.adjustmentType === 'admin_remove' ? '-' : '+'}
                                {formatGb(purchase.creditsGb)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                {purchase.reason || (purchase.adjustmentType === 'purchase' ? `$${purchase.amountPaid.toFixed(2)}` : '-')}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {/* Pagination Controls */}
                      {balanceData.pagination && (
                        <div className="flex items-center justify-between px-4 py-3 border-t">
                          <p className="text-sm text-muted-foreground">
                            Page {balanceData.pagination.page} of {balanceData.pagination.totalPages}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={balanceData.pagination.page <= 1}
                              onClick={() => selectedOrg && loadBalance(selectedOrg, balanceData.pagination!.page - 1)}
                            >
                              <ChevronLeft className="h-4 w-4 mr-1" />
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={balanceData.pagination.page >= balanceData.pagination.totalPages}
                              onClick={() => selectedOrg && loadBalance(selectedOrg, balanceData.pagination!.page + 1)}
                            >
                              Next
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No transaction history
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Add Credits Dialog */}
          {selectedOrg && (
            <AdjustCreditsDialog
              organization={selectedOrg}
              balance={balanceData?.creditsGb ?? null}
              isOpen={isAddDialogOpen}
              onClose={() => setIsAddDialogOpen(false)}
              onSuccess={() => loadBalance(selectedOrg, balanceData?.pagination?.page || 1)}
              mode="add"
            />
          )}

          {/* Remove Credits Dialog */}
          {selectedOrg && (
            <AdjustCreditsDialog
              organization={selectedOrg}
              balance={balanceData?.creditsGb ?? null}
              isOpen={isRemoveDialogOpen}
              onClose={() => setIsRemoveDialogOpen(false)}
              onSuccess={() => loadBalance(selectedOrg, balanceData?.pagination?.page || 1)}
              mode="remove"
            />
          )}
        </TabsContent>

        <TabsContent value="settings">
          <EgressPackSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EgressCreditManager;
