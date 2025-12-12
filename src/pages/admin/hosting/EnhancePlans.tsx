import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Save, ChevronDown, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Plan {
    id: string;
    name: string;
    description: string;
    service_type: string;
    price_monthly: string;
    subscriber_count: string;
    is_active: boolean;
    features: string[];
}

interface LocalEdits {
    [planId: string]: {
        name?: string;
        description?: string;
        price_monthly?: string;
        features?: string;
    };
}

export default function EnhancePlans() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [localEdits, setLocalEdits] = useState<LocalEdits>({});
    const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
    const [openPlanIds, setOpenPlanIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const data = await api.get('/admin/enhance/plans');
            const plansWithFeatures = data.map((p: any) => ({
                ...p,
                features: Array.isArray(p.features) ? p.features : (p.features ? Object.values(p.features) : [])
            }));
            setPlans(plansWithFeatures);
            setLocalEdits({});
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

    const toggleOpen = (planId: string) => {
        setOpenPlanIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(planId)) {
                newSet.delete(planId);
            } else {
                newSet.add(planId);
            }
            return newSet;
        });
    };

    const getLocalValue = (planId: string, field: 'name' | 'description' | 'price_monthly' | 'features', originalValue: string) => {
        const edits = localEdits[planId];
        if (edits && edits[field] !== undefined) {
            return edits[field];
        }
        return originalValue;
    };

    const handleLocalChange = (planId: string, field: 'name' | 'description' | 'price_monthly' | 'features', value: string) => {
        setLocalEdits(prev => ({
            ...prev,
            [planId]: {
                ...prev[planId],
                [field]: value
            }
        }));
    };

    const hasChanges = (planId: string) => {
        return localEdits[planId] !== undefined && Object.keys(localEdits[planId]).length > 0;
    };

    const savePlan = async (planId: string) => {
        const edits = localEdits[planId];
        if (!edits) return;

        const plan = plans.find(p => p.id === planId);
        if (!plan) return;

        setSavingIds(prev => new Set(prev).add(planId));

        const updates: any = {};
        if (edits.name !== undefined) updates.name = edits.name;
        if (edits.description !== undefined) updates.description = edits.description;
        if (edits.price_monthly !== undefined) updates.price_monthly = edits.price_monthly;
        if (edits.features !== undefined) {
            updates.features = edits.features.split('\n').filter((f: string) => f.trim() !== '');
        }

        try {
            await api.put(`/admin/enhance/plans/${planId}`, updates);
            toast.success('Plan updated');
            setPlans(plans.map(p => p.id === planId ? {
                ...p,
                ...updates,
                features: updates.features || p.features
            } : p));
            setLocalEdits(prev => {
                const newEdits = { ...prev };
                delete newEdits[planId];
                return newEdits;
            });
        } catch {
            toast.error('Update failed');
        } finally {
            setSavingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(planId);
                return newSet;
            });
        }
    };

    const toggleActive = async (e: React.MouseEvent, planId: string, currentActive: boolean) => {
        e.stopPropagation();
        setPlans(plans.map(p => p.id === planId ? { ...p, is_active: !currentActive } : p));
        try {
            await api.put(`/admin/enhance/plans/${planId}`, { is_active: !currentActive });
            toast.success('Plan updated');
        } catch {
            toast.error('Update failed');
            fetchPlans();
        }
    };

    if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Hosting Plans</h2>
                <Button onClick={handleSync} disabled={isSyncing} variant="outline" className="w-full sm:w-auto">
                    {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Sync from Enhance
                </Button>
            </div>

            {plans.length === 0 ? (
                <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                        No plans found. Click "Sync" to import from Enhance.
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {plans.map((plan) => {
                        const isOpen = openPlanIds.has(plan.id);
                        return (
                            <Collapsible key={plan.id} open={isOpen} onOpenChange={() => toggleOpen(plan.id)}>
                                <Card>
                                    <CollapsibleTrigger asChild>
                                        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                {isOpen ? (
                                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                )}
                                                <div>
                                                    <div className="font-semibold">{plan.name}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        ${plan.price_monthly}/mo • {plan.subscriber_count} subscribers
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline">Web Hosting</Badge>
                                                <Button
                                                    variant={plan.is_active ? "default" : "secondary"}
                                                    size="sm"
                                                    onClick={(e) => toggleActive(e, plan.id, plan.is_active)}
                                                >
                                                    {plan.is_active ? 'Active' : 'Disabled'}
                                                </Button>
                                            </div>
                                        </div>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <CardContent className="pt-0 pb-4 px-4 border-t">
                                            <div className="grid gap-4 pt-4">
                                                {/* Form fields */}
                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`name-${plan.id}`}>Plan Name</Label>
                                                        <Input
                                                            id={`name-${plan.id}`}
                                                            value={getLocalValue(plan.id, 'name', plan.name)}
                                                            onChange={(e) => handleLocalChange(plan.id, 'name', e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`price-${plan.id}`}>Monthly Price ($)</Label>
                                                        <Input
                                                            id={`price-${plan.id}`}
                                                            type="number"
                                                            value={getLocalValue(plan.id, 'price_monthly', plan.price_monthly)}
                                                            onChange={(e) => handleLocalChange(plan.id, 'price_monthly', e.target.value)}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor={`description-${plan.id}`}>Description (shown under plan name)</Label>
                                                    <Input
                                                        id={`description-${plan.id}`}
                                                        value={getLocalValue(plan.id, 'description', plan.description || '')}
                                                        placeholder="e.g. Premium Hosting, Starter Plan, etc."
                                                        onChange={(e) => handleLocalChange(plan.id, 'description', e.target.value)}
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor={`features-${plan.id}`}>Features (one per line)</Label>
                                                    <Textarea
                                                        id={`features-${plan.id}`}
                                                        value={getLocalValue(plan.id, 'features', plan.features?.join('\n') || '')}
                                                        placeholder="Enter features, one per line"
                                                        className="min-h-[100px] resize-none"
                                                        onChange={(e) => handleLocalChange(plan.id, 'features', e.target.value)}
                                                    />
                                                </div>

                                                {/* Save button */}
                                                <div className="flex justify-end">
                                                    <Button
                                                        disabled={!hasChanges(plan.id) || savingIds.has(plan.id)}
                                                        onClick={() => savePlan(plan.id)}
                                                        className="w-full sm:w-auto"
                                                    >
                                                        {savingIds.has(plan.id) ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <Save className="mr-2 h-4 w-4" />
                                                                Save Changes
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </CollapsibleContent>
                                </Card>
                            </Collapsible>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
