import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Play, RefreshCw, Terminal } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function NodeTab({ serviceId }: { serviceId: string }) {
    const [app, setApp] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        fetchApp();
    }, [serviceId]);

    const fetchApp = async () => {
        try {
            const data = await api.get(`/hosting/node/${serviceId}/app`);
            setApp(data);
        } catch {
            // toast.error('Failed to load app status');
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (action: 'restart' | 'npm-install') => {
        setActionLoading(action);
        try {
            await api.post(`/hosting/node/${serviceId}/${action}`);
            toast.success(action === 'restart' ? 'App restarted' : 'Dependencies installed');
        } catch (e: any) {
            toast.error(e.response?.data?.error || 'Action failed');
        } finally {
            setActionLoading(null);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        // simplified creation logic
        const formData = new FormData(e.target as HTMLFormElement);
        try {
            await api.post(`/hosting/node/${serviceId}/app`, {
                version: formData.get('version'),
                entryPoint: formData.get('entryPoint')
            });
            toast.success('App created');
            fetchApp();
        } catch (e) { }
    };

    if (loading) return <Loader2 className="animate-spin" />;

    if (!app) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Create Node.js Application</CardTitle>
                    <CardDescription>Configure your runtime environment</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleCreate} className="space-y-4 max-w-md">
                        <div className="space-y-2">
                            <Label>Node Version</Label>
                            <Select name="version" defaultValue="18">
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="14">v14</SelectItem>
                                    <SelectItem value="16">v16</SelectItem>
                                    <SelectItem value="18">v18</SelectItem>
                                    <SelectItem value="20">v20</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Entry Point</Label>
                            <Input name="entryPoint" defaultValue="server.js" />
                        </div>
                        <Button type="submit">Initialize App</Button>
                    </form>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Application Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-muted rounded-full">
                            <Terminal className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="font-bold">Node.js {app.version}</div>
                            <div className="text-sm text-muted-foreground">Entry: {app.entryPoint}</div>
                        </div>
                        <div className="ml-auto">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Running
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => handleAction('restart')}
                            disabled={!!actionLoading}
                        >
                            {actionLoading === 'restart' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Restart App
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => handleAction('npm-install')}
                            disabled={!!actionLoading}
                        >
                            {actionLoading === 'npm-install' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                            Run NPM Install
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
