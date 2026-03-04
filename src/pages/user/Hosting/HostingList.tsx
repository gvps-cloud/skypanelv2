import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Server, Plus, ExternalLink, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Service {
    id: string;
    domain: string;
    status: string;
    plan_name: string;
    service_type: string;
    created_at: string;
}

export default function HostingList() {
    const [services, setServices] = useState<Service[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isHostingDisabled, setIsHostingDisabled] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        fetchServices();
    }, []);

    const fetchServices = async () => {
        try {
            const data = await api.get('/hosting/store/services');
            setServices(data);
        } catch (error: any) {
            console.error('Failed to load services', error);
            // Check if hosting is disabled (403 error with specific message)
            if (error?.error?.includes('disabled') || error?.status === 403) {
                setIsHostingDisabled(true);
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

    if (isHostingDisabled) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                <div className="bg-amber-500/10 p-4 rounded-full">
                    <AlertCircle className="h-12 w-12 text-amber-500" />
                </div>
                <h2 className="text-2xl font-bold">Web Hosting is Disabled</h2>
                <p className="text-muted-foreground max-w-md">
                    Web hosting services are currently disabled. Please contact support for more information.
                </p>
                <Button onClick={() => navigate('/dashboard')}>
                    Return to Dashboard
                </Button>
            </div>
        );
    }

    if (services.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                <div className="bg-primary/10 p-4 rounded-full">
                    <Server className="h-12 w-12 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">No Hosting Services Found</h2>
                <p className="text-muted-foreground max-w-sm">
                    You haven't purchased any hosting plans yet. Get started by deploying your first website.
                </p>
                <Button onClick={() => navigate('/hosting/new')}>
                    <Plus className="mr-2 h-4 w-4" /> Deploy New Service
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">My Hosting Services</h1>
                    <p className="text-muted-foreground">Manage your deployed websites and applications</p>
                </div>
                <Button onClick={() => navigate('/hosting/new')}>
                    <Plus className="mr-2 h-4 w-4" /> New Service
                </Button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {services.map(service => (
                    <Card key={service.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate(`/hosting/${service.id}`)}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {service.plan_name}
                            </CardTitle>
                            <Badge variant={service.status === 'active' ? 'default' : 'secondary'}>
                                {service.status}
                            </Badge>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold truncate">{service.domain}</div>
                            <p className="text-xs text-muted-foreground capitalize">
                                {service.service_type} Hosting
                            </p>
                        </CardContent>
                        <CardFooter>
                            <Button variant="ghost" className="w-full justify-start pl-0 hover:bg-transparent">
                                Manage Service <ExternalLink className="ml-2 h-4 w-4" />
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
