import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';

export default function WebTab({ serviceId }: { serviceId: string }) {
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, [serviceId]);

    const fetchSettings = async () => {
        try {
            const data = await api.get(`/hosting/web/${serviceId}/php`);
            setSettings(data.data);
        } catch {
            // toast.error('Failed to load PHP settings');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (version: string) => {
        setIsUpdating(true);
        try {
            await api.put(`/hosting/web/${serviceId}/php`, { version });
            toast.success('PHP Version Updated');
            // Refresh settings
            setSettings({ ...settings, phpVersion: version });
        } catch (e: any) {
            toast.error('Update failed');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleRestart = async () => {
        try {
            await api.post(`/hosting/web/${serviceId}/restart-php`);
            toast.success('PHP Restarted');
        } catch {
            toast.error('Restart failed');
        }
    }

    if (loading) return <Loader2 className="animate-spin" />;

    // Default if API returns empty
    const currentVersion = settings?.phpVersion || '8.1';

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>PHP Configuration</CardTitle>
                    <CardDescription>Manage your PHP runtime environment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 max-w-md">
                    <div className="space-y-2">
                        <Label>PHP Version</Label>
                        <div className="flex gap-4">
                            <Select value={currentVersion} onValueChange={handleUpdate} disabled={isUpdating}>
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="7.4">PHP 7.4 (Legacy)</SelectItem>
                                    <SelectItem value="8.0">PHP 8.0</SelectItem>
                                    <SelectItem value="8.1">PHP 8.1</SelectItem>
                                    <SelectItem value="8.2">PHP 8.2</SelectItem>
                                    <SelectItem value="8.3">PHP 8.3</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="outline" size="icon" onClick={handleRestart}>
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
