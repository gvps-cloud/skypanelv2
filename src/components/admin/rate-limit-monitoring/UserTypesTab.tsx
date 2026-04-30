import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import type { RateLimitMetrics, RateLimitHealthResponse } from './types';

interface UserTypesTabProps {
  metrics: RateLimitMetrics;
  healthCheck: RateLimitHealthResponse;
  formatNumber: (num: number) => string;
}

export function UserTypesTab({ metrics, healthCheck, formatNumber }: UserTypesTabProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Anonymous Users</CardTitle>
          <CardDescription>Unauthenticated requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Requests</span>
              <span className="font-medium">{formatNumber(metrics.anonymousRequests)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Violations</span>
              <span className="font-medium text-destructive">
                {formatNumber(metrics.anonymousViolations)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Configured Limit</span>
              <span className="font-medium text-right">
                {healthCheck.configuration.limits.anonymous}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Authenticated Users</CardTitle>
          <CardDescription>Requests with valid tokens</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Requests</span>
              <span className="font-medium">{formatNumber(metrics.authenticatedRequests)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Violations</span>
              <span className="font-medium text-destructive">
                {formatNumber(metrics.authenticatedViolations)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Configured Limit</span>
              <span className="font-medium text-right">
                {healthCheck.configuration.limits.authenticated}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Admin Users</CardTitle>
          <CardDescription>Administrative requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Requests</span>
              <span className="font-medium">{formatNumber(metrics.adminRequests)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Violations</span>
              <span className="font-medium text-destructive">
                {formatNumber(metrics.adminViolations)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Configured Limit</span>
              <span className="font-medium text-right">
                {healthCheck.configuration.limits.admin}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}