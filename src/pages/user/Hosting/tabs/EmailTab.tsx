import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Trash2, Plus } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function EmailTab({ serviceId }: { serviceId: string }) {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        fetchAccounts();
    }, [serviceId]);

    const fetchAccounts = async () => {
        try {
            const data = await api.get(`/hosting/email/${serviceId}/accounts`);
            setAccounts(data);
        } catch {
            // toast.error('Failed to load accounts');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        const formData = new FormData(e.target as HTMLFormElement);
        try {
            await api.post(`/hosting/email/${serviceId}/accounts`, {
                email: formData.get('email'),
                password: formData.get('password'),
                quota: 1024
            });
            toast.success('Account created');
            setIsOpen(false);
            fetchAccounts();
        } catch (e: any) {
            toast.error('Failed to create account');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (email: string) => {
        if (!confirm('Are you sure?')) return;
        try {
            await api.delete(`/hosting/email/${serviceId}/accounts/${encodeURIComponent(email)}`);
            toast.success('Account deleted');
            setAccounts(accounts.filter(a => a.email !== email)); // optimstic
        } catch {
            toast.error('Delete failed');
        }
    };

    if (loading) return <Loader2 className="animate-spin" />;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Email Accounts</h3>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Create Account</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>New Email Account</DialogTitle></DialogHeader>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Email Address</Label>
                                <Input name="email" placeholder="user@domain.com" required />
                            </div>
                            <div className="space-y-2">
                                <Label>Password</Label>
                                <Input name="password" type="password" required />
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isCreating}>
                                    {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Create
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Address</TableHead>
                                <TableHead>Quota</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {accounts.map(acc => (
                                <TableRow key={acc.email || acc.address}>
                                    <TableCell>{acc.email || acc.address}</TableCell>
                                    <TableCell>{acc.quota ? `${acc.quota} MB` : 'Unlimited'}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="destructive" size="sm" onClick={() => handleDelete(acc.email || acc.address)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {accounts.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                                        No email accounts found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
