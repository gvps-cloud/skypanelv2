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
    Loader2,
    CheckCircle2,
    Circle,
    X,
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
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
    phone?: string;
    timezone?: string;
    created_at: string;
    updated_at: string;
}

interface BulkDeleteResult {
    deleted: { id: string; name: string; email: string }[];
    skipped: { id: string; name: string; email: string; reason: string }[];
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

interface UserRowProps {
    user: AdminUser;
    onView: (user: AdminUser) => void;
    onEdit: (user: AdminUser) => void;
    onImpersonate: (user: AdminUser) => void;
    onDelete: (user: AdminUser) => void;
    isImpersonating: boolean;
    selected: boolean;
    onToggleSelect: (userId: string) => void;
}

const UserRow: React.FC<UserRowProps> = ({ user, onView, onEdit, onImpersonate, onDelete, isImpersonating, selected, onToggleSelect }) => (
    <TableRow className={cn("group cursor-pointer", selected && 'bg-primary/5 hover:bg-primary/10')} onClick={() => onToggleSelect(user.id)}>
        <TableCell className="w-12">
            <Button
                variant="ghost"
                size="icon"
                className={cn(
                    "h-8 w-8 rounded-full transition-colors",
                    selected
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect(user.id);
                }}
                aria-label={selected ? `Deselect ${user.name}` : `Select ${user.name}`}
            >
                {selected ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
            </Button>
        </TableCell>
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
                        onClick={(e) => e.stopPropagation()}
                    >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => onView(user)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(user)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit User
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => onImpersonate(user)}
                        disabled={isImpersonating}
                    >
                        <UserCheck className="h-4 w-4 mr-2" />
                        Impersonate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); onDelete(user); }}
                        className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete User
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </TableCell>
    </TableRow>
);

export const UserManagement: React.FC = () => {
    const { token, user: currentUser } = useAuth();
    const { startImpersonation, isStarting } = useImpersonation();
    const navigate = useNavigate();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [error, setError] = useState<string>('');

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const [selectedAdminIds, setSelectedAdminIds] = useState<Set<string>>(new Set());
    const [selectedRegularUserIds, setSelectedRegularUserIds] = useState<Set<string>>(new Set());

    const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
    const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('');
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [bulkDeleteResults, setBulkDeleteResults] = useState<BulkDeleteResult | null>(null);
    const [bulkDeleteResultsOpen, setBulkDeleteResultsOpen] = useState(false);

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

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, roleFilter]);

    const adminUsers = useMemo(() => {
        return filteredUsers.filter(u => u.role === 'admin');
    }, [filteredUsers]);

    const regularUsers = useMemo(() => {
        return filteredUsers.filter(u => u.role !== 'admin');
    }, [filteredUsers]);

    const totalItems = regularUsers.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const paginatedRegularUsers = regularUsers.slice(startIndex, endIndex);

    const someAdminsSelected = adminUsers.some(u => selectedAdminIds.has(u.id));
    const allAdminsSelected = adminUsers.length > 0 && adminUsers.every(u => selectedAdminIds.has(u.id));
    const adminIndeterminate = someAdminsSelected && !allAdminsSelected;

    const someUsersSelected = paginatedRegularUsers.some(u => selectedRegularUserIds.has(u.id));
    const allUsersSelected = paginatedRegularUsers.length > 0 && paginatedRegularUsers.every(u => selectedRegularUserIds.has(u.id));
    const usersIndeterminate = someUsersSelected && !allUsersSelected;

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

    const handleToggleAdmin = useCallback((userId: string) => {
        setSelectedAdminIds(prev => {
            const next = new Set(prev);
            if (next.has(userId)) {
                next.delete(userId);
            } else {
                next.add(userId);
            }
            return next;
        });
    }, []);

    const handleToggleUser = useCallback((userId: string) => {
        setSelectedRegularUserIds(prev => {
            const next = new Set(prev);
            if (next.has(userId)) {
                next.delete(userId);
            } else {
                next.add(userId);
            }
            return next;
        });
    }, []);

    const handleToggleAllAdmins = useCallback(() => {
        const adminIds = adminUsers.map(u => u.id);
        setSelectedAdminIds(prev => {
            const next = new Set(prev);
            const allSelected = adminIds.length > 0 && adminIds.every(id => prev.has(id));
            if (allSelected) {
                adminIds.forEach(id => next.delete(id));
            } else {
                adminIds.forEach(id => next.add(id));
            }
            return next;
        });
    }, [adminUsers]);

    const handleToggleAllUsers = useCallback(() => {
        const userIds = paginatedRegularUsers.map(u => u.id);
        setSelectedRegularUserIds(prev => {
            const next = new Set(prev);
            const allSelected = userIds.length > 0 && userIds.every(id => prev.has(id));
            if (allSelected) {
                userIds.forEach(id => next.delete(id));
            } else {
                userIds.forEach(id => next.add(id));
            }
            return next;
        });
    }, [paginatedRegularUsers]);

    const handleClearSelection = useCallback(() => {
        setSelectedAdminIds(new Set());
        setSelectedRegularUserIds(new Set());
    }, []);

    const selectedUserCount = selectedAdminIds.size + selectedRegularUserIds.size;

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

    const handleDeleteDialogClose = useCallback((open: boolean) => {
        if (!open) {
            setDeleteDialogOpen(false);
            setSelectedUser(null);
            setDeleteConfirmEmail('');
        }
    }, []);

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
            setSelectedAdminIds(prev => {
                const next = new Set(prev);
                next.delete(selectedUser.id);
                return next;
            });
            setSelectedRegularUserIds(prev => {
                const next = new Set(prev);
                next.delete(selectedUser.id);
                return next;
            });
            await fetchUsers();
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete user');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleBulkDeleteClick = () => {
        if (selectedUserCount === 0) return;
        const ids = [...selectedAdminIds, ...selectedRegularUserIds];
        if (ids.includes(currentUser?.id || '') && ids.length === 1) {
            toast.error('You cannot delete your own account');
            return;
        }
        setBulkDeleteConfirmText('');
        setBulkDeleteResults(null);
        setBulkDeleteDialogOpen(true);
    };

    const handleBulkDeleteDialogClose = useCallback((open: boolean) => {
        if (!open) {
            setBulkDeleteDialogOpen(false);
            setBulkDeleteConfirmText('');
        }
    }, []);

    const handleBulkDeleteConfirm = async () => {
        if (bulkDeleteConfirmText !== 'DELETE') {
            toast.error('Please type DELETE to confirm bulk deletion');
            return;
        }

        setIsBulkDeleting(true);
        const userIds = [...selectedAdminIds, ...selectedRegularUserIds].filter(id => id !== currentUser?.id);

        if (userIds.length === 0) {
            toast.error('Cannot delete your own account');
            setIsBulkDeleting(false);
            return;
        }

        try {
            const result = await apiClient.post<BulkDeleteResult>('/admin/users/bulk-delete', {
                userIds,
            });

            setBulkDeleteDialogOpen(false);
            setBulkDeleteConfirmText('');
            setSelectedAdminIds(new Set());
            setSelectedRegularUserIds(new Set());
            setBulkDeleteResults(result);

            const { deleted, skipped } = result;

            if (skipped.length > 0) {
                setBulkDeleteResultsOpen(true);
            } else {
                toast.success(`Successfully deleted ${deleted.length} user${deleted.length !== 1 ? 's' : ''}`);
            }

            await fetchUsers();
        } catch (error: any) {
            toast.error(error.message || 'Failed to bulk delete users');
        } finally {
            setIsBulkDeleting(false);
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

    const totalUsers = users.length;
    const adminCount = users.filter((u) => u.role === 'admin').length;
    const userCount = users.filter((u) => u.role === 'user').length;

    return (
        <>
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

                <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
                    <Users className="absolute right-10 top-10 h-32 w-32 rotate-12" />
                </div>
            </div>

            {selectedUserCount > 0 && (
                <Card className="mb-4 border-primary/20 bg-primary/5">
                    <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                                    {selectedUserCount}
                                </div>
                                <div>
                                    <p className="font-medium">
                                        {selectedUserCount} user{selectedUserCount !== 1 ? 's' : ''} selected
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Click a row or the circle icon to select/deselect
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    onClick={handleBulkDeleteClick}
                                    variant="destructive"
                                    size="sm"
                                >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete Selected
                                </Button>
                                <Button
                                    onClick={handleClearSelection}
                                    variant="outline"
                                    size="sm"
                                >
                                    <X className="h-4 w-4 mr-1" />
                                    Clear
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

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

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                            {searchTerm || roleFilter !== 'all' ? (
                                <>Found {filteredUsers.length} results</>
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

                    {loading ? (
                        <div className="py-12 text-center text-muted-foreground">
                            <RefreshCw className="mx-auto h-8 w-8 animate-spin mb-2" />
                            <p>Loading users...</p>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">
                            <Users className="mx-auto h-8 w-8 opacity-50 mb-2" />
                            <p>No users found</p>
                            {searchTerm && (
                                <p className="text-xs mt-1">Try adjusting your search</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {adminUsers.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-primary" />
                                        <h3 className="font-semibold text-lg">Administrators</h3>
                                        <Badge variant="secondary" className="ml-2">{adminUsers.length}</Badge>
                                    </div>
                                    <div className="rounded-lg border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-12">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className={cn(
                                                                "h-7 w-7 rounded-full",
                                                                allAdminsSelected
                                                                    ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
: adminIndeterminate
                                                                        ? "bg-primary/20 text-primary hover:bg-primary/30"
                                                                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                                            )}
                                                            onClick={handleToggleAllAdmins}
                                                            aria-label="Select all administrators"
                                                        >
                                                            {allAdminsSelected ? <CheckCircle2 className="h-4 w-4" /> : adminIndeterminate ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                                                        </Button>
                                                    </TableHead>
                                                    <TableHead>User</TableHead>
                                                    <TableHead>Role</TableHead>
                                                    <TableHead className="hidden md:table-cell">Created</TableHead>
                                                    <TableHead className="w-16 text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {adminUsers.map((user) => (
                                                    <UserRow
                                                        key={user.id}
                                                        user={user}
                                                        onView={handleViewUser}
                                                        onEdit={handleEditUser}
                                                        onImpersonate={handleImpersonate}
                                                        onDelete={handleDeleteClick}
                                                        isImpersonating={isStarting}
                                                        selected={selectedAdminIds.has(user.id)}
                                                        onToggleSelect={handleToggleAdmin}
                                                    />
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}

                            {(paginatedRegularUsers.length > 0 || (adminUsers.length === 0 && !loading)) && (
                                <div className="space-y-3">
                                    {adminUsers.length > 0 && (
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4 text-muted-foreground" />
                                            <h3 className="font-semibold text-lg">Users</h3>
                                            <Badge variant="secondary" className="ml-2">{regularUsers.length}</Badge>
                                        </div>
                                    )}
                                    <div className="rounded-lg border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-12">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className={cn(
                                                                "h-7 w-7 rounded-full",
                                                                allUsersSelected
                                                                    ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
: usersIndeterminate
                                                                        ? "bg-primary/20 text-primary hover:bg-primary/30"
                                                                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                                            )}
                                                            onClick={handleToggleAllUsers}
                                                            aria-label="Select all users on this page"
                                                        >
                                                            {allUsersSelected ? <CheckCircle2 className="h-4 w-4" /> : usersIndeterminate ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                                                        </Button>
                                                    </TableHead>
                                                    <TableHead>User</TableHead>
                                                    <TableHead>Role</TableHead>
                                                    <TableHead className="hidden md:table-cell">Created</TableHead>
                                                    <TableHead className="w-16 text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {paginatedRegularUsers.length > 0 ? (
                                                    paginatedRegularUsers.map((user) => (
                                                        <UserRow
                                                            key={user.id}
                                                            user={user}
                                                            onView={handleViewUser}
                                                            onEdit={handleEditUser}
                                                            onImpersonate={handleImpersonate}
                                                            onDelete={handleDeleteClick}
                                                            isImpersonating={isStarting}
                                                            selected={selectedRegularUserIds.has(user.id)}
                                                            onToggleSelect={handleToggleUser}
                                                        />
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                                            No users found on this page.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!loading && totalItems > 0 && (
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-4 border-t">
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

            <UserEditModal
                user={selectedUser}
                isOpen={editModalOpen}
                onClose={() => {
                    setEditModalOpen(false);
                    setSelectedUser(null);
                }}
                onSuccess={handleModalSuccess}
            />

            {/* Single Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogClose}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete User Account</DialogTitle>
                        <DialogDescription asChild>
                            <div className="space-y-4">
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
                                        disabled={isDeleting}
                                    />
                                </div>

                                {deleteConfirmEmail && deleteConfirmEmail !== selectedUser?.email && (
                                    <p className="text-sm text-destructive">
                                        Email address does not match. Please type the exact email address.
                                    </p>
                                )}
                            </div>
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleDeleteDialogClose(false)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDeleteUser}
                            disabled={deleteConfirmEmail !== selectedUser?.email || isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete User Permanently'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk Delete Confirmation Dialog */}
            <Dialog open={bulkDeleteDialogOpen} onOpenChange={handleBulkDeleteDialogClose}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Delete {selectedUserCount} User{selectedUserCount !== 1 ? 's' : ''}
                        </DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. The following users will be permanently deleted:
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="max-h-40 overflow-y-auto rounded-md border p-3">
                            <ul className="space-y-1">
                                {[...selectedAdminIds, ...selectedRegularUserIds].filter(id => id !== currentUser?.id).map(userId => {
                                    const user = users.find(u => u.id === userId);
                                    return (
                                        <li key={userId} className="text-sm flex items-center gap-2">
                                            <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                                            <span className="font-medium">{user?.name || 'Unknown'}</span>
                                            <span className="text-muted-foreground">{user?.email || userId}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>

                        {(selectedAdminIds.has(currentUser?.id || '') || selectedRegularUserIds.has(currentUser?.id || '')) && (
                            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 dark:bg-amber-950/20 dark:border-amber-800">
                                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                    Your own account is selected and will be skipped — you cannot delete yourself.
                                </p>
                            </div>
                        )}

                        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
                            <p className="text-sm font-medium text-destructive">
                                Users with active VPS instances, negative wallet balances, or open support tickets cannot be deleted and will be skipped.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="bulk-confirm-delete" className="text-sm font-medium">
                                Type <span className="font-mono font-bold">DELETE</span> to confirm:
                            </Label>
                            <Input
                                id="bulk-confirm-delete"
                                value={bulkDeleteConfirmText}
                                onChange={(e) => setBulkDeleteConfirmText(e.target.value)}
                                placeholder="Type DELETE to confirm"
                                className="font-mono"
                                disabled={isBulkDeleting}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleBulkDeleteDialogClose(false)}
                            disabled={isBulkDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleBulkDeleteConfirm}
                            disabled={bulkDeleteConfirmText !== 'DELETE' || isBulkDeleting}
                        >
                            {isBulkDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                `Delete ${selectedUserCount} User${selectedUserCount !== 1 ? 's' : ''}`
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk Delete Results Dialog */}
            <Dialog open={bulkDeleteResultsOpen} onOpenChange={setBulkDeleteResultsOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Bulk Delete Results</DialogTitle>
                        <DialogDescription>
                            {bulkDeleteResults && bulkDeleteResults.skipped.length > 0
                                ? `${bulkDeleteResults.deleted.length} user(s) deleted, ${bulkDeleteResults.skipped.length} could not be deleted.`
                                : 'All selected users have been deleted successfully.'}
                        </DialogDescription>
                    </DialogHeader>

                    {bulkDeleteResults && (
                        <div className="space-y-4">
                            {bulkDeleteResults.deleted.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">
                                        Deleted ({bulkDeleteResults.deleted.length})
                                    </h4>
                                    <div className="max-h-32 overflow-y-auto rounded-md border border-green-200 dark:border-green-800 p-2">
                                        <ul className="space-y-1">
                                            {bulkDeleteResults.deleted.map((u) => (
                                                <li key={u.id} className="text-sm flex items-center gap-2">
                                                    <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                                                    <span className="font-medium">{u.name}</span>
                                                    <span className="text-muted-foreground">{u.email}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {bulkDeleteResults.skipped.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">
                                        Skipped ({bulkDeleteResults.skipped.length})
                                    </h4>
                                    <div className="max-h-32 overflow-y-auto rounded-md border border-amber-200 dark:border-amber-800 p-2">
                                        <ul className="space-y-1">
                                            {bulkDeleteResults.skipped.map((u) => (
                                                <li key={u.id} className="text-sm flex items-start gap-2">
                                                    <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                                    <div>
                                                        <span className="font-medium">{u.name}</span>
                                                        <span className="text-muted-foreground ml-1">{u.email}</span>
                                                        <p className="text-xs text-muted-foreground">{u.reason}</p>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setBulkDeleteResultsOpen(false)}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                        <AlertDialogDescription asChild>
                            <div className="space-y-2">
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
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setImpersonationConfirmDialog({ isOpen: false, targetUser: null })}>
                            Cancel
                        </AlertDialogCancel>
                        <Button
                            type="button"
                            onClick={handleConfirmAdminImpersonation}
                            className="bg-amber-600 text-white hover:bg-amber-700"
                        >
                            Confirm Impersonation
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};