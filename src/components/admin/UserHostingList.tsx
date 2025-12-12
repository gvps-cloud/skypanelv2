import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Globe, ExternalLink } from 'lucide-react';

interface HostingService {
    id: string;
    domain: string;
    status: string;
    enhance_website_id: string | null;
    primary_ip: string | null;
    plan_name: string | null;
    service_type: string | null;
    price_monthly: number | null;
    created_at: string;
}

interface UserHostingListProps {
    hostingServices: HostingService[];
}

export const UserHostingList: React.FC<UserHostingListProps> = ({ hostingServices }) => {
    const getStatusBadgeClass = (status: string) => {
        switch (status.toLowerCase()) {
            case 'active':
                return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'provisioning':
                return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'suspended':
                return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'cancelled':
                return 'bg-slate-400/10 text-slate-400 border-slate-400/20';
            case 'error':
                return 'bg-red-500/10 text-red-500 border-red-500/20';
            default:
                return 'bg-muted text-muted-foreground border-muted';
        }
    };

    const getServiceTypeLabel = (type: string | null) => {
        switch (type?.toLowerCase()) {
            case 'web':
                return 'Web Hosting';
            case 'email':
                return 'Email';
            case 'wordpress':
                return 'WordPress';
            case 'node':
                return 'Node.js';
            default:
                return type || 'Unknown';
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    if (hostingServices.length === 0) {
        return (
            <Card className="border-border bg-card">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <Globe className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Web Hosting Services</h3>
                    <p className="text-muted-foreground text-center">
                        This user hasn't purchased any web hosting services yet.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border bg-card">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Web Hosting Services ({hostingServices.length})
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Domain</TableHead>
                                <TableHead>Plan</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {hostingServices.map((service) => (
                                <TableRow key={service.id}>
                                    <TableCell className="font-medium">
                                        {service.domain}
                                    </TableCell>
                                    <TableCell>
                                        {service.plan_name || '—'}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-xs">
                                            {getServiceTypeLabel(service.service_type)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={getStatusBadgeClass(service.status)}
                                        >
                                            {service.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {formatDate(service.created_at)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                asChild
                                            >
                                                <Link to={`/hosting/${service.id}`}>
                                                    <ExternalLink className="h-4 w-4 mr-1" />
                                                    View
                                                </Link>
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};
