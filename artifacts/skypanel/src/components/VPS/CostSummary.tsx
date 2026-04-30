/**
 * CostSummary Component
 * Displays itemized cost breakdown for VPS creation
 */

import React, { useState, useEffect } from "react";
import { DollarSign, Server, Shield } from "lucide-react";
import { apiClient } from "@/lib/api";
import type { VPSPlan } from "@/types/vps";

interface CostSummaryProps {
  planId: string;
  backupsEnabled: boolean;
  backupFrequency?: "daily" | "weekly" | "none";
}

export const CostSummary: React.FC<CostSummaryProps> = ({
  planId,
  backupsEnabled,
  backupFrequency = "none",
}) => {
  const [plan, setPlan] = useState<VPSPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlan = async () => {
      if (!planId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await apiClient.get<{ plans?: VPSPlan[] }>("/api/vps/plans");

        const selectedPlan = (data.plans || []).find(
          (p: VPSPlan) => p.id === planId
        );

        setPlan(selectedPlan || null);
      } catch (err) {
        console.error("Failed to fetch plan details:", err);
        setPlan(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, [planId]);

  if (loading || !plan) {
    return null;
  }

  // Helper function to safely convert to number
  const safeNumber = (value: any): number => {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  };

  // Calculate costs
  const baseMonthlyCost = safeNumber(plan.base_price) + safeNumber(plan.markup_price);
  const baseHourlyCost = baseMonthlyCost / 730;

  let backupMonthlyCost = 0;
  let backupHourlyCost = 0;

  if (backupsEnabled && backupFrequency && backupFrequency !== "none") {
    const baseBackupMonthly = safeNumber(plan.backup_price_monthly);
    const backupUpchargeMonthly = safeNumber(plan.backup_upcharge_monthly);
    const dailyMultiplier = backupFrequency === "daily" ? 1.5 : 1;

    backupMonthlyCost = (baseBackupMonthly + backupUpchargeMonthly) * dailyMultiplier;
    backupHourlyCost = backupMonthlyCost / 730;
  }

  const totalMonthlyCost = baseMonthlyCost + backupMonthlyCost;
  const totalHourlyCost = baseHourlyCost + backupHourlyCost;

  return (
    <div className="rounded-lg border-2 border-primary/20 bg-primary/5 dark:bg-primary/10 p-4 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <DollarSign className="h-5 w-5 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">Cost Summary</h4>
      </div>

      {/* Base VPS Cost */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">Base VPS</span>
          </div>
          <div className="text-right">
            <div className="font-semibold text-foreground">
              ${baseMonthlyCost.toFixed(2)}/mo
            </div>
            <div className="text-xs text-muted-foreground">
              ${baseHourlyCost.toFixed(6)}/hr
            </div>
          </div>
        </div>

        {/* Backup Cost */}
        {backupsEnabled && backupFrequency !== "none" && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">
                Backups ({backupFrequency === "daily" ? "Daily" : "Weekly"})
              </span>
            </div>
            <div className="text-right">
              <div className="font-semibold text-foreground">
                ${backupMonthlyCost.toFixed(2)}/mo
              </div>
              <div className="text-xs text-muted-foreground">
                ${backupHourlyCost.toFixed(6)}/hr
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Total */}
      <div className="pt-3 border-t border-primary/20">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Total Cost</span>
          <div className="text-right">
            <div className="text-lg font-bold text-primary">
              ${totalMonthlyCost.toFixed(2)}/mo
            </div>
            <div className="text-xs text-muted-foreground">
              ${totalHourlyCost.toFixed(6)}/hr
            </div>
          </div>
        </div>
      </div>

      {/* Billing Note */}
      <div className="pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground">
          You will be billed hourly based on actual usage. Monthly cost shown is
          an estimate for 730 hours (30.4 days).
        </p>
      </div>
    </div>
  );
};
