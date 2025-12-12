import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

export default function OverviewTab({ service }: { service: any }) {
    // Mock FTP details if API doesn't return them yet
    const ftpHost = `ftp.${service.domain}`;
    const ftpUser = `${service.domain.split('.')[0]}_user`;

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Service Status</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold capitalize text-green-600">{service.status}</div>
                    <p className="text-xs text-muted-foreground">Active since today</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Plan Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{service.plan?.name}</div>
                    <p className="text-xs text-muted-foreground capitalize">{service.plan?.service_type} Hosting</p>
                </CardContent>
            </Card>

            <Card className="col-span-full md:col-span-1">
                <CardHeader>
                    <CardTitle className="text-sm font-medium">FTP Access</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Host:</span>
                        <span>{ftpHost}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">User:</span>
                        <span>{ftpUser}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Port:</span>
                        <span>21</span>
                    </div>
                    <Button variant="outline" size="sm" className="w-full mt-2">Reset Password</Button>
                </CardContent>
            </Card>

            <Card className="col-span-full">
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-4">
                    <Button variant="outline" onClick={() => window.open(`http://${service.domain}`, '_blank')}>
                        <ExternalLink className="mr-2 h-4 w-4" /> Visit Website
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
