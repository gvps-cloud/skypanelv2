import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ExternalLink } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function WordpressTab({ serviceId }: { serviceId: string }) {
    const [loading, setLoading] = useState(false);
    const [ssoUrl, setSsoUrl] = useState<string | null>(null);

    // We could fetch status on mount, for now simple Install/SSO buttons
    // Assuming user knows if they installed it or we check an 'installed' flag
    // Simplification: Try SSO, if fail, show install form.

    const handleSSO = async () => {
        setLoading(true);
        try {
            const data = await api.get(`/hosting/wordpress/${serviceId}/sso`);
            window.open(data.url, '_blank');
        } catch {
            toast.error('WordPress not found or SSO failed');
        } finally {
            setLoading(false);
        }
    };

    const handleInstall = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.target as HTMLFormElement);
        try {
            await api.post(`/hosting/wordpress/${serviceId}/install`, {
                title: formData.get('title'),
                adminUser: formData.get('adminUser')
            });
            toast.success('WordPress Installed!');
        } catch (e: any) {
            toast.error('Install failed');
        } finally {
            setLoading(false);
        }
    };

    if (!ssoUrl && !loading) {
        // Logic: In a real app we'd check `isInstalled` state.
        // Here we render both options or a tabbed view inside the tab.
        // Let's render the Install Form and an SSO button at top.
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>WordPress Management</CardTitle>
                    <CardDescription>Manage your WordPress installation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50 dark:bg-slate-900">
                        <div>
                            <h3 className="font-medium">Admin Access</h3>
                            <p className="text-sm text-muted-foreground">Log in to your WordPress Dashboard securely</p>
                        </div>
                        <Button onClick={handleSSO} disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <ExternalLink className="mr-2 h-4 w-4" /> WP Admin SSO
                        </Button>
                    </div>

                    <div className="border-t pt-6">
                        <h3 className="font-medium mb-4">New Installation</h3>
                        <form onSubmit={handleInstall} className="grid gap-4 max-w-md">
                            <div className="space-y-2">
                                <Label>Site Title</Label>
                                <Input name="title" placeholder="My Awesome Blog" required />
                            </div>
                            <div className="space-y-2">
                                <Label>Admin Username</Label>
                                <Input name="adminUser" placeholder="admin" required />
                            </div>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Install WordPress
                            </Button>
                        </form>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
