import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { RateLimitMetrics } from './types';

interface OverviewTabProps {
  metrics: RateLimitMetrics;
  getRequestShare: (requests: number) => number;
  formatPercentage: (num: number) => string;
  formatNumber: (num: number) => string;
}

export function OverviewTab({
  metrics,
  getRequestShare,
  formatPercentage,
  formatNumber,
}: OverviewTabProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Request Distribution</CardTitle>
            <CardDescription>Breakdown by user authentication type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Anonymous</span>
                <span className="text-sm text-muted-foreground">
                  {formatNumber(metrics.anonymousRequests)} requests
                </span>
              </div>
              <Progress value={getRequestShare(metrics.anonymousRequests)} className="h-2" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Authenticated</span>
                <span className="text-sm text-muted-foreground">
                  {formatNumber(metrics.authenticatedRequests)} requests
                </span>
              </div>
              <Progress value={getRequestShare(metrics.authenticatedRequests)} className="h-2" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Admin</span>
                <span className="text-sm text-muted-foreground">
                  {formatNumber(metrics.adminRequests)} requests
                </span>
              </div>
              <Progress value={getRequestShare(metrics.adminRequests)} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Limit Utilization</CardTitle>
            <CardDescription>Average percentage of limits being used</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Anonymous Users</span>
                <span className="text-sm text-muted-foreground">
                  {formatPercentage(metrics.configEffectiveness.anonymousLimitUtilization)}
                </span>
              </div>
              <Progress
                value={metrics.configEffectiveness.anonymousLimitUtilization}
                className="h-2"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Authenticated Users</span>
                <span className="text-sm text-muted-foreground">
                  {formatPercentage(metrics.configEffectiveness.authenticatedLimitUtilization)}
                </span>
              </div>
              <Progress
                value={metrics.configEffectiveness.authenticatedLimitUtilization}
                className="h-2"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Admin Users</span>
                <span className="text-sm text-muted-foreground">
                  {formatPercentage(metrics.configEffectiveness.adminLimitUtilization)}
                </span>
              </div>
              <Progress
                value={metrics.configEffectiveness.adminLimitUtilization}
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {metrics.configEffectiveness.recommendedAdjustments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recommendations</CardTitle>
            <CardDescription>System-generated suggestions for optimization</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {metrics.configEffectiveness.recommendedAdjustments.map((recommendation, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span>{recommendation}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}