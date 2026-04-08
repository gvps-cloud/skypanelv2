import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRateLimitData } from './useRateLimitData';
import { useOverrideManager } from './useOverrideManager';
import { StatusCards } from './StatusCards';
import { OverviewTab } from './OverviewTab';
import { UserTypesTab } from './UserTypesTab';
import { ViolationsTab } from './ViolationsTab';
import { ConfigurationTab } from './ConfigurationTab';
import { OverridesTab } from './OverridesTab';
import { formatNumber, formatPercentage } from './utils';

export const RateLimitMonitoring: React.FC = () => {
  const data = useRateLimitData();
  const overrideManager = useOverrideManager({
    defaultOverrideLimit: data.defaultOverrideLimit,
    defaultOverrideWindow: data.defaultOverrideWindow,
    fetchOverrides: data.fetchOverrides,
    fetchHealthCheck: data.fetchHealthCheck,
  });

  if (!data.metrics || !data.healthCheck) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading rate limiting monitoring data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StatusCards
        healthCheck={data.healthCheck}
        metrics={data.metrics}
        activeOverrides={data.activeOverrides}
        loading={data.loading}
        lastUpdated={data.lastUpdated}
        onRefresh={() => data.refreshData(true)}
      />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="user-types">User Types</TabsTrigger>
          <TabsTrigger value="violations">Violations</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="overrides">Overrides</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <OverviewTab
            metrics={data.metrics}
            getRequestShare={data.getRequestShare}
            formatPercentage={formatPercentage}
            formatNumber={formatNumber}
          />
        </TabsContent>

        <TabsContent value="user-types" className="space-y-4">
          <UserTypesTab
            metrics={data.metrics}
            healthCheck={data.healthCheck}
            formatNumber={formatNumber}
          />
        </TabsContent>

        <TabsContent value="violations" className="space-y-4">
          <ViolationsTab metrics={data.metrics} />
        </TabsContent>

        <TabsContent value="configuration" className="space-y-4">
          <ConfigurationTab healthCheck={data.healthCheck} />
        </TabsContent>

        <TabsContent value="overrides" className="space-y-4">
          <OverridesTab
            overrides={data.overrides}
            overridesLoading={data.overridesLoading}
            activeOverrides={data.activeOverrides}
            defaultOverrideLimit={data.defaultOverrideLimit}
            defaultOverrideWindow={data.defaultOverrideWindow}
            overrideDialogOpen={overrideManager.overrideDialogOpen}
            selectedOverride={overrideManager.selectedOverride}
            overrideForm={overrideManager.overrideForm}
            setOverrideForm={overrideManager.setOverrideForm}
            savingOverride={overrideManager.savingOverride}
            deletingOverrideId={overrideManager.deletingOverrideId}
            onRefreshOverrides={data.fetchOverrides}
            onOpenOverrideDialog={overrideManager.openOverrideDialog}
            onCloseOverrideDialog={overrideManager.closeOverrideDialog}
            onOverrideSubmit={overrideManager.handleOverrideSubmit}
            onDeleteOverride={overrideManager.handleDeleteOverride}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};