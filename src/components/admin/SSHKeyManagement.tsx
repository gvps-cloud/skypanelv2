/**
 * Admin SSH Key Management Component
 * Allows admins to view and manage SSH keys across all organizations
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Key,
  RefreshCw,
  Search,
  Trash2,
  Copy,
  Check,
  Plus,
  Building2,
  Calendar,
  AlertTriangle,
  Server,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { validateSSHPublicKey } from '@/lib/validation';
import type { AdminSSHKey } from '@/types/organizations';

interface Organization {
  id: string;
  name: string;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

// Helper to format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Helper to truncate fingerprint for display
const truncateFingerprint = (fingerprint: string) => {
  if (fingerprint.length <= 23) return fingerprint;
  return `${fingerprint.substring(0, 11)}...${fingerprint.substring(fingerprint.length - 11)}`;
};

// Helper to truncate public key
const truncatePublicKey = (publicKey: string) => {
  const parts = publicKey.trim().split(/\s+/);
  const keyType = parts[0] || '';
  const keyData = parts[1] || '';
  
  if (keyData.length <= 20) {
    return `${keyType} ${keyData}`;
  }
  
  return `${keyType} ${keyData.substring(0, 10)}...${keyData.substring(keyData.length - 10)}`;
};

// Copy button component
const CopyButton: React.FC<{ text: string; label: string }> = ({ text, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0"
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );
};

interface SSHKeyRowProps {
  sshKey: AdminSSHKey;
  onDelete: (key: AdminSSHKey) => void;
}

const SSHKeyRow: React.FC<SSHKeyRowProps> = ({ sshKey, onDelete }) => (
  <TableRow className="group">
    <TableCell>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Key className="h-5 w-5" />
        </div>
        <div>
          <p className="font-medium">{sshKey.name}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            {sshKey.organization_name}
          </p>
        </div>
      </div>
    </TableCell>
    <TableCell>
      <div className="flex items-center gap-2">
        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
          {truncateFingerprint(sshKey.fingerprint)}
        </code>
        <CopyButton text={sshKey.fingerprint} label="Fingerprint" />
      </div>
    </TableCell>
    <TableCell className="hidden lg:table-cell">
      <div className="flex items-center gap-2">
        <code className="text-xs bg-muted px-2 py-1 rounded font-mono max-w-[200px] truncate">
          {truncatePublicKey(sshKey.public_key)}
        </code>
        <CopyButton text={sshKey.public_key} label="Public key" />
      </div>
    </TableCell>
    <TableCell className="hidden md:table-cell">
      {sshKey.linode_key_id ? (
        <Badge variant="outline" className="border-green-400/30 bg-green-400/10 text-green-600 dark:text-green-400">
          <Check className="h-3 w-3 mr-1" />
          Synced
        </Badge>
      ) : (
        <Badge variant="outline" className="border-yellow-400/30 bg-yellow-400/10 text-yellow-600 dark:text-yellow-400">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Local Only
        </Badge>
      )}
    </TableCell>
    <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
      {sshKey.creator ? (
        <div className="flex items-center gap-1">
          <span>{sshKey.creator.name || sshKey.creator.email}</span>
        </div>
      ) : (
        <span className="text-muted-foreground/50">Unknown</span>
      )}
    </TableCell>
    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
      <div className="flex items-center gap-1">
        <Calendar className="h-3 w-3" />
        {formatDate(sshKey.created_at)}
      </div>
    </TableCell>
    <TableCell className="text-right">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={() => onDelete(sshKey)}
            className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Key
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TableCell>
  </TableRow>
);

export const SSHKeyManagement: React.FC = () => {
  const { token } = useAuth();
  const [sshKeys, setSSHKeys] = useState<AdminSSHKey[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Modal states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<AdminSSHKey | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Add key form state
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPublicKey, setNewKeyPublicKey] = useState('');
  const [newKeyOrganizationId, setNewKeyOrganizationId] = useState('');
  const [formErrors, setFormErrors] = useState<{ name?: string; publicKey?: string; organization?: string }>({});

  const fetchSSHKeys = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', currentPage.toString());
      params.set('limit', itemsPerPage.toString());
      if (searchTerm) {
        params.set('search', searchTerm);
      }

      const data = await apiClient.get<{
        keys: AdminSSHKey[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/admin/ssh-keys?${params.toString()}`);

      setSSHKeys(data.keys || []);
      setTotalItems(data.pagination?.total || 0);
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load SSH keys';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [token, currentPage, itemsPerPage, searchTerm]);

  const fetchOrganizations = useCallback(async () => {
    if (!token) return;

    try {
      const data = await apiClient.get<{ organizations: Organization[] }>('/organizations/all');
      setOrganizations(data.organizations || []);
    } catch (error: any) {
      console.error('Failed to load organizations:', error);
    }
  }, [token]);

  useEffect(() => {
    fetchSSHKeys();
  }, [fetchSSHKeys]);

  useEffect(() => {
    if (addDialogOpen) {
      fetchOrganizations();
    }
  }, [addDialogOpen, fetchOrganizations]);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Pagination handlers
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToFirstPage = () => goToPage(1);
  const goToLastPage = () => goToPage(totalPages);
  const goToPrevPage = () => goToPage(currentPage - 1);
  const goToNextPage = () => goToPage(currentPage + 1);

  const handleItemsPerPageChange = (value: string) => {
    const newItemsPerPage = parseInt(value);
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  // Handlers
  const handleDeleteClick = (key: AdminSSHKey) => {
    setSelectedKey(key);
    setDeleteDialogOpen(true);
  };

  const handleDeleteKey = async () => {
    if (!selectedKey) return;

    setIsDeleting(true);
    try {
      await apiClient.delete(`/admin/ssh-keys/${selectedKey.id}`);
      toast.success('SSH key deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedKey(null);
      fetchSSHKeys();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete SSH key');
    } finally {
      setIsDeleting(false);
    }
  };

  const validateAddForm = (): boolean => {
    const errors: { name?: string; publicKey?: string; organization?: string } = {};

    if (!newKeyName.trim()) {
      errors.name = 'Name is required';
    } else if (newKeyName.length > 100) {
      errors.name = 'Name must be less than 100 characters';
    }

    if (!newKeyOrganizationId) {
      errors.organization = 'Organization is required';
    }

    const keyValidation = validateSSHPublicKey(newKeyPublicKey);
    if (!keyValidation.valid) {
      errors.publicKey = keyValidation.error;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddKey = async () => {
    if (!validateAddForm()) return;

    setIsAdding(true);
    try {
      await apiClient.post('/admin/ssh-keys', {
        organizationId: newKeyOrganizationId,
        name: newKeyName.trim(),
        publicKey: newKeyPublicKey.trim(),
      });

      toast.success('SSH key added successfully');
      setAddDialogOpen(false);
      setNewKeyName('');
      setNewKeyPublicKey('');
      setNewKeyOrganizationId('');
      setFormErrors({});
      fetchSSHKeys();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add SSH key');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRefresh = () => {
    fetchSSHKeys();
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
        <div className="relative z-10">
          <Badge variant="secondary" className="mb-2">
            Administration
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight">SSH Key Management</h2>
          <p className="text-muted-foreground mt-1">
            View and manage SSH keys across all organizations
          </p>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="bg-background/50 backdrop-blur-sm rounded-lg p-4 border">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Total Keys</span>
              </div>
              <p className="text-2xl font-bold mt-1">{totalItems}</p>
            </div>
            <div className="bg-background/50 backdrop-blur-sm rounded-lg p-4 border">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium text-muted-foreground">Synced to Linode</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {sshKeys.filter(k => k.linode_key_id).length}
              </p>
            </div>
            <div className="bg-background/50 backdrop-blur-sm rounded-lg p-4 border">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium text-muted-foreground">Organizations</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {new Set(sshKeys.map(k => k.organization_id)).size}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>All SSH Keys</CardTitle>
              <CardDescription>
                Manage SSH keys across all organizations
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Refresh
              </Button>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Key
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by key name, fingerprint, or organization..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="rounded-lg bg-destructive/10 p-4 mb-6">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-3 w-[150px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : sshKeys.length === 0 ? (
            <div className="text-center py-12">
              <Key className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No SSH keys found</h3>
              <p className="text-muted-foreground mt-1">
                {searchTerm
                  ? 'Try adjusting your search terms'
                  : 'No SSH keys have been added yet'}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name / Organization</TableHead>
                      <TableHead>Fingerprint</TableHead>
                      <TableHead className="hidden lg:table-cell">Public Key</TableHead>
                      <TableHead className="hidden md:table-cell">Status</TableHead>
                      <TableHead className="hidden xl:table-cell">Created By</TableHead>
                      <TableHead className="hidden lg:table-cell">Created</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sshKeys.map((key) => (
                      <SSHKeyRow
                        key={key.id}
                        sshKey={key}
                        onDelete={handleDeleteClick}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={handleItemsPerPageChange}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option.toString()}>
                        {option} / page
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages || 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={goToFirstPage}
                      disabled={currentPage === 1}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={goToPrevPage}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={goToNextPage}
                      disabled={currentPage >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={goToLastPage}
                      disabled={currentPage >= totalPages}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add Key Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add SSH Key</DialogTitle>
            <DialogDescription>
              Add an SSH key to a specific organization
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="organization">Organization</Label>
              <Select
                value={newKeyOrganizationId}
                onValueChange={setNewKeyOrganizationId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.organization && (
                <p className="text-sm text-destructive">{formErrors.organization}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Key Name</Label>
              <Input
                id="name"
                placeholder="My SSH Key"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
              {formErrors.name && (
                <p className="text-sm text-destructive">{formErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="publicKey">Public Key</Label>
              <Textarea
                id="publicKey"
                placeholder="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC... user@host"
                className="font-mono text-sm min-h-[120px]"
                value={newKeyPublicKey}
                onChange={(e) => setNewKeyPublicKey(e.target.value)}
              />
              {formErrors.publicKey && (
                <p className="text-sm text-destructive">{formErrors.publicKey}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Supported formats: ssh-rsa, ssh-ed25519, ecdsa-sha2-*
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddDialogOpen(false);
                setNewKeyName('');
                setNewKeyPublicKey('');
                setNewKeyOrganizationId('');
                setFormErrors({});
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddKey} disabled={isAdding}>
              {isAdding ? 'Adding...' : 'Add Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle>Delete SSH Key</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedKey?.name}" from "{selectedKey?.organization_name}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-4">
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <p className="text-sm font-medium text-foreground">
                This action will:
              </p>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>Remove the key from the organization</li>
                <li>Delete the key from all cloud providers</li>
                <li>Prevent using this key for new VPS instances</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Existing VPS instances using this key will not be affected.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteKey();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete SSH Key'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
