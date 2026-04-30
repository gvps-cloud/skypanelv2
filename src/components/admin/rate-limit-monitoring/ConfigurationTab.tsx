import React from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { RateLimitHealthResponse } from './types';

interface ConfigurationTabProps {
  healthCheck: RateLimitHealthResponse;
}

export function ConfigurationTab({ healthCheck }: ConfigurationTabProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuration Status</CardTitle>
            <CardDescription>Current rate limiting configuration health</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Configuration Valid</span>
              <Badge variant={healthCheck.health.configValid ? 'default' : 'destructive'}>
                {healthCheck.health.configValid ? 'Valid' : 'Invalid'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Trust Proxy Enabled</span>
              <Badge variant={healthCheck.health.trustProxyEnabled ? 'default' : 'secondary'}>
                {healthCheck.health.trustProxyEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Limits Configured</span>
              <Badge variant={healthCheck.health.limitsConfigured ? 'default' : 'destructive'}>
                {healthCheck.health.limitsConfigured ? 'Configured' : 'Missing'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Metrics Enabled</span>
              <Badge variant={healthCheck.health.metricsEnabled ? 'default' : 'secondary'}>
                {healthCheck.health.metricsEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Limits</CardTitle>
            <CardDescription>Active rate limiting configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Anonymous Users</span>
                <span className="text-sm text-muted-foreground text-right">
                  {healthCheck.configuration.limits.anonymous}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Authenticated Users</span>
                <span className="text-sm text-muted-foreground text-right">
                  {healthCheck.configuration.limits.authenticated}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Admin Users</span>
                <span className="text-sm text-muted-foreground text-right">
                  {healthCheck.configuration.limits.admin}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {(healthCheck.validation.errors.length > 0 ||
        healthCheck.validation.warnings.length > 0 ||
        healthCheck.validation.recommendations.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(healthCheck.validation.errors.length > 0 ||
            healthCheck.validation.warnings.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-destructive">Issues</CardTitle>
                <CardDescription>Configuration problems that need attention</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {[...healthCheck.validation.errors, ...healthCheck.validation.warnings].map(
                    (issue, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                        <span>{issue}</span>
                      </li>
                    ),
                  )}
                </ul>
              </CardContent>
            </Card>
          )}

          {healthCheck.validation.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-primary">Recommendations</CardTitle>
                <CardDescription>Suggested improvements for better performance</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {healthCheck.validation.recommendations.map((recommendation, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}