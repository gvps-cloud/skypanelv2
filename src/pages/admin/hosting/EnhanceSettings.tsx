import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';

interface EnhanceConfigForm {
    name: string;
    api_url: string;
    org_id: string;
    api_key: string;
    enabled: boolean;
}

export default function EnhanceSettings() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [hasSavedKey, setHasSavedKey] = useState(false);

    const { register, handleSubmit, reset, getValues, watch } = useForm<EnhanceConfigForm>({
        defaultValues: {
            enabled: true,
        }
    });

    const enabled = watch('enabled');

    const handleToggleEnabled = async (checked: boolean) => {
        const currentValues = getValues();
        try {
            // Only send the enabled field and non-empty values to avoid validation issues
            await api.post('/admin/enhance/config', {
                enabled: checked,
                // Preserve existing config values
                name: currentValues.name || '',
                api_url: currentValues.api_url || '',
                org_id: currentValues.org_id || '',
                // Don't send api_key unless it has a real value (not the placeholder)
                ...(currentValues.api_key && currentValues.api_key !== '' ? { api_key: currentValues.api_key } : {})
            });
            reset({ ...currentValues, enabled: checked });
            toast.success(checked ? 'Web hosting enabled' : 'Web hosting disabled');
        } catch (error: any) {
            toast.error(error.message || 'Failed to update web hosting status');
            // Revert the toggle on error
            reset({ ...currentValues });
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const data = await api.get('/admin/enhance/config');
            if (data) {
                setHasSavedKey(!!data.api_key);
                reset({
                    name: data.name,
                    api_url: data.api_url,
                    org_id: data.org_id,
                    api_key: '', // Don't fill password field
                    enabled: data.enabled ?? true,
                });
            }
        } catch (error) {
            toast.error('Failed to load settings');
        } finally {
            setIsLoading(false);
        }
    };

    const onSubmit = async (data: EnhanceConfigForm) => {
        setIsSaving(true);
        try {
            await api.post('/admin/enhance/config', data);
            toast.success('Configuration saved successfully');
        } catch (error: any) {
            toast.error(error.message || 'Failed to save configuration');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTest = async () => {
        const values = getValues();
        // Allow empty key if we have a saved one, backend will handle it
        if (!values.api_key && !hasSavedKey) {
            return toast.error('Please enter API Key to test connection');
        }

        setIsTesting(true);
        try {
            const response = await api.post('/admin/enhance/test-connection', values);
            if (response.success) {
                toast.success('Connection Successful!');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || error.message || 'Connection Failed');
        } finally {
            setIsTesting(false);
        }
    };

    if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Enhance Integration</h2>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Web Hosting Status</CardTitle>
                    <CardDescription>
                        Enable or disable web hosting services for clients. When disabled, web hosting options will be hidden from the client interface.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <Label htmlFor="enabled">Enable Web Hosting</Label>
                            <p className="text-sm text-muted-foreground">
                                {enabled ? 'Web hosting is currently visible to clients' : 'Web hosting is currently hidden from clients'}
                            </p>
                        </div>
                        <Switch
                            id="enabled"
                            checked={enabled}
                            onCheckedChange={handleToggleEnabled}
                        />
                    </div>
                </CardContent>
            </Card>

            {enabled && (
                <Card>
                    <CardHeader>
                        <CardTitle>API Configuration</CardTitle>
                        <CardDescription>
                            Connect to your Enhance Control Panel cluster.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Cluster Name</Label>
                                <Input id="name" {...register('name')} placeholder="Primary Cluster" />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="api_url">API URL</Label>
                                <Input id="api_url" {...register('api_url', { required: true })} placeholder="https://api.enhance.com" />
                                <p className="text-sm text-muted-foreground">The full URL to your Enhance Orchd API.</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="org_id">Organization ID</Label>
                                <Input id="org_id" {...register('org_id', { required: true })} placeholder="uuid-..." />
                                <p className="text-sm text-muted-foreground">The ID of your reseller organization.</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="api_key">API Key</Label>
                                <Input
                                    id="api_key"
                                    type="password"
                                    {...register('api_key')} // Not required if we have saved key
                                    placeholder={hasSavedKey ? "Leave blank to use saved key" : "sk_..."}
                                />
                                <p className="text-sm text-muted-foreground">An API access token with full permissions.</p>
                            </div>

                            <div className="pt-4 flex gap-4">
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Connection
                                </Button>
                                <Button type="button" variant="secondary" onClick={handleTest} disabled={isTesting}>
                                    {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Test Connection
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {!enabled && (
                <Card>
                    <CardHeader>
                        <CardTitle>API Configuration</CardTitle>
                        <CardDescription>
                            Web hosting is currently disabled. Enable web hosting to configure your Enhance integration.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center py-8 text-muted-foreground">
                        Configuration fields are hidden when web hosting is disabled
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
