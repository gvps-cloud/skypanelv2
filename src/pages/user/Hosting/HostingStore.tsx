import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import { useNavigate } from 'react-router-dom';

interface Plan {
    id: string;
    name: string;
    service_type: string;
    price_monthly: number;
    description?: string;
    features?: any;
}

interface Region {
    id: string;
    name: string;
}

export default function HostingStore() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const [domain, setDomain] = useState('');
    const [selectedRegion, setSelectedRegion] = useState('');
    const [isBuying, setIsBuying] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        fetchPlans();
        fetchRegions();
    }, []);

    const fetchPlans = async () => {
        try {
            const data = await api.get('/hosting/store/plans');
            setPlans(data);
        } catch {
            toast.error('Failed to load plans');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchRegions = async () => {
        try {
            const data = await api.get('/hosting/store/regions');
            setRegions(data);
            if (data.length > 0) {
                setSelectedRegion(data[0].id);
            }
        } catch {
            console.error('Failed to load regions');
        }
    };

    const handlePurchase = async () => {
        if (!domain) return toast.error('Domain is required');

        setIsBuying(true);
        try {
            const response = await api.post('/hosting/store/purchase', {
                planId: selectedPlan?.id,
                domain,
                region: selectedRegion
            });
            toast.success('Service provisioned successfully!');
            setSelectedPlan(null); // Close modal
            navigate(`/hosting/${response.subscriptionId}`); // Redirect to dashboard
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Purchase failed');
        } finally {
            setIsBuying(false);
        }
    };

    const getPlansByType = (type: string) => plans.filter(p => p.service_type === type);

    const PlanCard = ({ plan }: { plan: Plan }) => (
        <Card className="flex flex-col">
            <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description || 'Premium Hosting'}</CardDescription>
                <div className="mt-4 text-3xl font-bold">${plan.price_monthly}<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
            </CardHeader>
            <CardContent className="flex-1">
                <ul className="space-y-2 text-sm">
                    {/* Placeholder features strictly for demo as we don't have detailed feature list synced yet */}
                    <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-primary" /> NVMe Storage</li>
                    <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-primary" /> Unmetered Bandwidth</li>
                    <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-primary" /> 24/7 Support</li>
                </ul>
            </CardContent>
            <CardFooter>
                <Button className="w-full" onClick={() => setSelectedPlan(plan)}>Choose Plan</Button>
            </CardFooter>
        </Card>
    );

    if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-8 p-6">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">Cloud Hosting</h1>
                <p className="text-muted-foreground">Choose the perfect plan for your project</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {getPlansByType('web').map(plan => (
                    <PlanCard key={plan.id} plan={plan} />
                ))}
                {getPlansByType('web').length === 0 && (
                    <div className="col-span-3 text-center py-12 text-muted-foreground">
                        No web hosting plans available.
                    </div>
                )}
            </div>

            <Dialog open={!!selectedPlan} onOpenChange={() => setSelectedPlan(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Configure Your Service</DialogTitle>
                        <DialogDescription>
                            Enter the domain name you want to use for this plan.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="domain" className="text-right">
                                Domain
                            </Label>
                            <Input
                                id="domain"
                                placeholder="example.com"
                                className="col-span-3"
                                value={domain}
                                onChange={(e) => setDomain(e.target.value)}
                            />
                        </div>
                        {regions.length > 0 && (
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="region" className="text-right">
                                    Region
                                </Label>
                                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder="Select a region" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {regions.map((region) => (
                                            <SelectItem key={region.id} value={region.id}>
                                                {region.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button onClick={handlePurchase} disabled={isBuying}>
                            {isBuying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Complete Order
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
