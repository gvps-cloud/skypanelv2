/**
 * User Management Component
 * Flat user list for admin management with pagination and search
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
    Users,
    RefreshCw,
    Search,
    Edit,
    Trash2,
    Eye,
    UserCheck,
    Calendar,
    AlertTriangle,
    Shield,
    Mail,
    MoreHorizontal,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { useImpersonation } from '@/contexts/ImpersonationContext';
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
    DropdownMenuSeparator,
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { UserEditModal } from './UserEditModal';

interface AdminUser {
    id: string;
    email: string;
    name: string;
    role: string;
    created_at: string;
    updated_at: string;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export const UserManagement: React.FC = () => {
    const { token } = useAuth();
    const { startImpersonation, isStarting } = useImpersonation();
    const navigate = useNavigate();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [error, setError] = useState<string>('');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Modal states
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    // Impersonation confirmation for admin users
    const [impersonationConfirmDialog, setImpersonationConfirmDialog] = useState<{
        isOpen: boolean;
        targetUser: AdminUser | null;
    }>({ isOpen: false, targetUser: null });

    const fetchUsers = useCallback(async () => {
        if (!token) return;

        setLoading(true);
        setError('');
        try {
            const data = await apiClient.get<{ users: AdminUser[] }>(
                '/admin/users'
            );
            setUsers(data.users || []);
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to load users';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Filter users based on search and role
    const filteredUsers = useMemo(() => {
        return users.filter((user) => {
            const matchesSearch =
                user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.id.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesRole = roleFilter === 'all' || user.role === roleFilter;
            return matchesSearch && matchesRole;
        });
    }, [users, searchTerm, roleFilter]);

    // Reset to first page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, roleFilter]);

    // Pagination calculations
    const totalItems = filteredUsers.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

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

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // Handlers
    const handleViewUser = (user: AdminUser) => {
        navigate(`/admin/user/${user.id}`);
    };

    const handleEditUser = (user: AdminUser) => {
        setSelectedUser(user);
        setEditModalOpen(true);
    };

    const handleDeleteClick = (user: AdminUser) => {
        setSelectedUser(user);
        setDeleteConfirmEmail('');
        setDeleteDialogOpen(true);
    };

    const handleDeleteUser = async () => {
        if (!selectedUser || deleteConfirmEmail !== selectedUser.email) {
            toast.error('Please type the user email exactly to confirm deletion');
            return;
        }

        setIsDeleting(true);
        try {
            await apiClient.delete(`/admin/users/${selectedUser.id}`);
            toast.success(`User "${selectedUser.name}" has been deleted`);
            setDeleteDialogOpen(false);
            setSelectedUser(null);
            setDeleteConfirmEmail('');
            fetchUsers();
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete user');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleImpersonate = async (user: AdminUser) => {
        try {
            await startImpersonation(user.id);
        } catch (error: any) {
            if (error.requiresConfirmation) {
                setImpersonationConfirmDialog({
                    isOpen: true,
                    targetUser: user,
                });
            } else {
                toast.error(error.message || 'Failed to start impersonation');
            }
        }
    };

    const handleConfirmAdminImpersonation = async () => {
        if (!impersonationConfirmDialog.targetUser) return;

        try {
            await startImpersonation(impersonationConfirmDialog.targetUser.id, true);
            setImpersonationConfirmDialog({ isOpen: false, targetUser: null });
        } catch (error: any) {
            toast.error(error.message || 'Failed to start admin impersonation');
        }
    };

    const handleModalSuccess = () => {
        setError('');
        fetchUsers();
        setSelectedUser(null);
    };

    const handleRefresh = async () => {
        setError('');
        await fetchUsers();
    };

    // Stats
    const totalUsers = users.length;
    const adminCount = users.filter((u) => u.role === 'admin').length;
    const userCount = users.filter((u) => u.role === 'user').length;

    return (
        <>
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8 mb-6">
                <div className="relative z-10">
                    <Badge variant="secondary" className="mb-3">
                        Administration
                    </Badge>
                    <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                        User Management
                    </h2>
                    <p className="mt-2 max-w-2xl text-muted-foreground">
                        Manage all users on the platform, edit permissions, and impersonate for support
                    </p>
                </div>

                {/* Stats */}
                <div className="mt-6 grid grid-cols-3 gap-4 max-w-md">
                    <div className="rounded-lg bg-background/50 backdrop-blur-sm border p-3 text-center">
                        <p className="text-2xl font-bold">{totalUsers}</p>
                        <p className="text-xs text-muted-foreground">Total Users</p>
                    </div>
                    <div className="rounded-lg bg-background/50 backdrop-blur-sm border p-3 text-center">
                        <p className="text-2xl font-bold text-primary">{adminCount}</p>
                        <p className="text-xs text-muted-foreground">Admins</p>
                    </div>
                    <div className="rounded-lg bg-background/50 backdrop-blur-sm border p-3 text-center">
                        <p className="text-2xl font-bold">{userCount}</p>
                        <p className="text-xs text-muted-foreground">Users</p>
                    </div>
                </div>

                {/* Background decoration */}
                <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
                    <Users className="absolute right-10 top-10 h-32 w-32 rotate-12" />
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                            <Users className="h-5 w-5 text-muted-foreground" />
                            All Users
                        </CardTitle>
                        <CardDescription>
                            View and manage all registered users
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={handleRefresh}
                            disabled={loading}
                        >
                            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                            {loading ? 'Refreshing…' : 'Refresh'}
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-6">
                    {/* Search and Filters */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="flex-1">
                            <Label htmlFor="user-search" className="sr-only">
                                Search users
                            </Label>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="user-search"
                                    placeholder="Search by name, email, or UUID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label htmlFor="role-filter" className="text-sm text-muted-foreground whitespace-nowrap">
                                Role:
                            </Label>
                            <Select value={roleFilter} onValueChange={setRoleFilter}>
                                <SelectTrigger id="role-filter" className="w-32">
                                    <SelectValue placeholder="All Roles" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Roles</SelectItem>
                                    <SelectItem value="admin">Admins</SelectItem>
                                    <SelectItem value="user">Users</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Results info */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                            {searchTerm || roleFilter !== 'all' ? (
                                <>Showing {filteredUsers.length} of {totalUsers} users</>
                            ) : (
                                <>{totalUsers} users total</>
                            )}
                        </span>
                        {totalPages > 1 && (
                            <span>
                                Page {currentPage} of {totalPages}
                            </span>
                        )}
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="font-medium">Error</span>
                            </div>
                            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={handleRefresh}
                            >
                                Try Again
                            </Button>
                        </div>
                    )}

                    {/* Users Table */}
                    <div className="rounded-lg border">
                        {loading ? (
                            <div className="py-12 text-center text-muted-foreground">
                                <RefreshCw className="mx-auto h-8 w-8 animate-spin mb-2" />
                                <p>Loading users...</p>
                            </div>
                        ) : paginatedUsers.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">
                                <Users className="mx-auto h-8 w-8 opacity-50 mb-2" />
                                <p>No users found</p>
                                {searchTerm && (
                                    <p className="text-xs mt-1">Try adjusting your search</p>
                                )}
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead className="hidden md:table-cell">Created</TableHead>
                                        <TableHead className="w-16 text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedUsers.map((user) => (
                                        <TableRow key={user.id} className="group">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                                                        {user.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">{user.name}</p>
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Mail className="h-3 w-3" />
                                                            {user.email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        user.role === 'admin' &&
                                                        'border-red-400/30 bg-red-400/10 text-red-600 dark:text-red-400'
                                                    )}
                                                >
                                                    {user.role === 'admin' && (
                                                        <Shield className="h-3 w-3 mr-1" />
                                                    )}
                                                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {formatDate(user.created_at)}
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
                                                        <DropdownMenuItem onClick={() => handleViewUser(user)}>
                                                            <Eye className="h-4 w-4 mr-2" />
                                                            View Details
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                                            <Edit className="h-4 w-4 mr-2" />
                                                            Edit User
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => handleImpersonate(user)}
                                                            disabled={isStarting}
                                                        >
                                                            <UserCheck className="h-4 w-4 mr-2" />
                                                            Impersonate
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() => handleDeleteClick(user)}
                                                            className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Delete User
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>

                    {/* Pagination Controls */}
                    {!loading && totalItems > 0 && (
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-4 border-t">
                            {/* Items per page selector */}
                            <div className="flex items-center gap-2">
                                <Label htmlFor="items-per-page" className="text-sm text-muted-foreground whitespace-nowrap">
                                    Show:
                                </Label>
                                <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                                    <SelectTrigger id="items-per-page" className="w-20">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                                            <SelectItem key={option} value={option.toString()}>
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <span className="text-sm text-muted-foreground">per page</span>
                            </div>

                            {/* Page info and navigation */}
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                    {startIndex + 1}–{endIndex} of {totalItems}
                                </span>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={goToFirstPage}
                                        disabled={currentPage === 1}
                                        title="First page"
                                    >
                                        <ChevronsLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={goToPrevPage}
                                        disabled={currentPage === 1}
                                        title="Previous page"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="px-2 text-sm font-medium">
                                        {currentPage} / {totalPages || 1}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={goToNextPage}
                                        disabled={currentPage >= totalPages}
                                        title="Next page"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={goToLastPage}
                                        disabled={currentPage >= totalPages}
                                        title="Last page"
                                    >
                                        <ChevronsRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit User Modal */}
            <UserEditModal
                user={selectedUser}
                isOpen={editModalOpen}
                onClose={() => {
                    setEditModalOpen(false);
                    setSelectedUser(null);
                }}
                onSuccess={handleModalSuccess}
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete User Account</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-4">
                            <p>
                                This will permanently delete <strong>{selectedUser?.name}</strong> and all associated data.
                            </p>

                            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
                                <p className="text-sm font-medium text-destructive">
                                    This action cannot be undone. All user data will be permanently lost.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirm-delete-email" className="text-sm font-medium">
                                    To confirm deletion, type the user's email address:
                                </Label>
                                <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                    {selectedUser?.email}
                                </p>
                                <Input
                                    id="confirm-delete-email"
                                    value={deleteConfirmEmail}
                                    onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                                    placeholder="Type the email address above"
                                    className="font-mono"
                                />
                            </div>

                            {deleteConfirmEmail && deleteConfirmEmail !== selectedUser?.email && (
                                <p className="text-sm text-destructive">
                                    Email address does not match. Please type the exact email address.
                                </p>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteUser}
                            disabled={deleteConfirmEmail !== selectedUser?.email || isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? 'Deleting...' : 'Delete User Permanently'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Impersonation Confirmation Dialog for Admin Users */}
            <AlertDialog
                open={impersonationConfirmDialog.isOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setImpersonationConfirmDialog({ isOpen: false, targetUser: null });
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Admin Impersonation</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                            <p>
                                You are about to impersonate <strong>{impersonationConfirmDialog.targetUser?.name}</strong>, who is also an administrator.
                            </p>
                            <div className="rounded-lg bg-muted p-3 space-y-1">
                                <p className="text-sm font-medium">Target User Details:</p>
                                <p className="text-sm">Name: {impersonationConfirmDialog.targetUser?.name}</p>
                                <p className="text-sm">Email: {impersonationConfirmDialog.targetUser?.email}</p>
                                <p className="text-sm">Role: {impersonationConfirmDialog.targetUser?.role}</p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                This action will be logged for security purposes. You will have full access to their account and data.
                            </p>
                            <p className="font-semibold text-amber-600">
                                Are you sure you want to proceed?
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setImpersonationConfirmDialog({ isOpen: false, targetUser: null })}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmAdminImpersonation}
                            className="bg-amber-600 text-white hover:bg-amber-700"
                        >
                            Confirm Impersonation
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
