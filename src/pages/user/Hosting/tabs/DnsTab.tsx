import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Trash2, Plus } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function DnsTab({ serviceId }: { serviceId: string }) {
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [recordType, setRecordType] = useState('A');

    useEffect(() => {
        fetchRecords();
    }, [serviceId]);

    const fetchRecords = async () => {
        try {
            const data = await api.get(`/hosting/dns/${serviceId}/records`);
            setRecords(data);
        } catch {
            // toast.error('Failed to load DNS records');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        const formData = new FormData(e.target as HTMLFormElement);
        try {
            await api.post(`/hosting/dns/${serviceId}/records`, {
                type: recordType,
                name: formData.get('name'),
                content: formData.get('content'),
            });
            toast.success('Record added');
            setIsOpen(false);
            fetchRecords();
        } catch (e: any) {
            toast.error('Failed to add record');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure?')) return;
        try {
            await api.delete(`/hosting/dns/${serviceId}/records/${id}`);
            toast.success('Record deleted');
            setRecords(records.filter(r => r.id !== id));
        } catch {
            toast.error('Delete failed');
        }
    };

    if (loading) return <Loader2 className="animate-spin" />;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">DNS Zone Records</h3>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Add Record</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Add DNS Record</DialogTitle></DialogHeader>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Select value={recordType} onValueChange={setRecordType}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="A">A (Address)</SelectItem>
                                        <SelectItem value="CNAME">CNAME (Alias)</SelectItem>
                                        <SelectItem value="MX">MX (Mail)</SelectItem>
                                        <SelectItem value="TXT">TXT (Text)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Name (Host)</Label>
                                <Input name="name" placeholder="@ or subdomain" required />
                            </div>
                            <div className="space-y-2">
                                <Label>Content (Value)</Label>
                                <Input name="content" placeholder="1.2.3.4" required />
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isCreating}>
                                    {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Add Record
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
                                <TableHead>Type</TableHead>
                                <TableHead>Host</TableHead>
                                <TableHead>Value</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {records.map(rec => (
                                <TableRow key={rec.id}>
                                    <TableCell className="font-mono">{rec.type}</TableCell>
                                    <TableCell className="font-mono">{rec.name}</TableCell>
                                    <TableCell className="font-mono truncate max-w-xs">{rec.content || rec.target}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(rec.id)}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {records.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                        No records found.
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
