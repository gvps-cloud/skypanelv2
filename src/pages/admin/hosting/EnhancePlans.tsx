import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Save } from 'lucide-react';
import api from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface Plan {
    id: string;
    name: string;
    service_type: string;
    price_monthly: string;
    subscriber_count: string;
    is_active: boolean;
}

export default function EnhancePlans() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isComputting, setIsComputting] = useState(false);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const data = await api.get('/admin/enhance/plans');
            setPlans(data);
        } catch {
            toast.error('Failed to load plans');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await api.post('/admin/enhance/sync-plans');
            toast.success('Plans synced from Enhance');
            fetchPlans();
        } catch {
            toast.error('Sync failed');
        } finally {
            setIsSyncing(false);
        }
    };

    const updatePlan = async (id: string, updates: Partial<Plan>) => {
        // Optimistic update
        setPlans(plans.map(p => p.id === id ? { ...p, ...updates } : p));

        // API Call
        try {
            await api.put(`/admin/enhance/plans/${id}`, updates);
            toast.success('Plan updated');
        } catch {
            toast.error('Update failed');
            fetchPlans(); // Revert
        }
    };

    if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Hosting Plans</h2>
                <Button onClick={handleSync} disabled={isSyncing} variant="outline">
                    {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Sync from Enhance
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Plan Name</TableHead>
                                <TableHead>Service Type</TableHead>
                                <TableHead>Monthly Price ($)</TableHead>
                                <TableHead>Active</TableHead>
                                <TableHead>Subscribers</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {plans.map((plan) => (
                                <TableRow key={plan.id}>
                                    <TableCell className="font-medium">
                                        <Input
                                            value={plan.name}
                                            className="w-48"
                                            onChange={(e) => updatePlan(plan.id, { name: e.target.value })}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Select
                                            value={plan.service_type}
                                            onValueChange={(val) => updatePlan(plan.id, { service_type: val })}
                                        >
                                            <SelectTrigger className="w-32">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="web">Web Hosting</SelectItem>
                                                <SelectItem value="email">Email Only</SelectItem>
                                                <SelectItem value="wordpress">WordPress</SelectItem>
                                                <SelectItem value="node">Node.js App</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            value={plan.price_monthly}
                                            className="w-24"
                                            onChange={(e) => updatePlan(plan.id, { price_monthly: e.target.value })}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant={plan.is_active ? "default" : "secondary"}
                                            size="sm"
                                            onClick={() => updatePlan(plan.id, { is_active: !plan.is_active })}
                                        >
                                            {plan.is_active ? 'Active' : 'Disabled'}
                                        </Button>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{plan.subscriber_count}</Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {plans.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        No plans found. Click "Sync" to import from Enhance.
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
