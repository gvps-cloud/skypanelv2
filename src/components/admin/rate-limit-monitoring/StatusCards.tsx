import React from 'react';
import { RefreshCw, Shield, TrendingUp, Users, Clock, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { RateLimitHealthResponse } from './types';
import type { RateLimitMetrics } from './types';
import { formatPercentage } from './utils';

interface StatusCardsProps {
  healthCheck: RateLimitHealthResponse;
  metrics: RateLimitMetrics;
  activeOverrides: number;
  loading: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
}

export function StatusCards({
  healthCheck,
  metrics,
  activeOverrides,
  loading,
  lastUpdated,
  onRefresh,
}: StatusCardsProps) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold leading-tight text-foreground sm:text-2xl">
              Rate Limiting Monitor
            </h2>
            <p className="text-sm text-muted-foreground">
              Real-time monitoring of API rate limiting effectiveness and system health
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void onRefresh();
            }}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Badge variant="outline" className="text-xs">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Never updated'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <Activity className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">System Status</p>
              <div className="flex items-center gap-2">
                <p
                  className={`text-2xl font-bold capitalize ${
                    healthCheck.status === 'error'
                      ? 'text-destructive'
                      : healthCheck.status === 'warning'
                        ? 'text-yellow-500'
                        : 'text-primary'
                  }`}
                >
                  {healthCheck.status}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <TrendingUp className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Hit Rate</p>
              <p className="text-2xl font-bold">{formatPercentage(metrics.rateLimitHitRate)}</p>
              <p className="text-xs text-muted-foreground">
                {metrics.rateLimitedRequests.toLocaleString()} of{' '}
                {metrics.totalRequests.toLocaleString()} requests
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
              <p className="text-2xl font-bold">{metrics.totalRequests.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Last {metrics.timeWindow}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Window</p>
              <p className="text-2xl font-bold">{metrics.timeWindow}</p>
              <p className="text-xs text-muted-foreground">Current observation window</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <Activity className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Overrides</p>
              <p className="text-2xl font-bold">{activeOverrides}</p>
              <p className="text-xs text-muted-foreground">Users with custom rate limits</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}