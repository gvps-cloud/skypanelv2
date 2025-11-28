/**
 * BackupConfiguration Component
 * Handles backup enable/disable and pricing display
 * 
 * Note: Linode's backup service runs daily automatic backups at a single flat rate.
 * There is no separate "daily" vs "weekly" pricing tier - backups are simply on or off.
 */

import React, { useState, useEffect } from "react";
import { Shield, DollarSign, Calendar, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import type { VPSPlan } from "@/types/vps";

// Normalizes API values that may arrive as strings so currency math stays reliable
const toCurrencyNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = parseFloat(value.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  return 0;
};

interface BackupConfigurationProps {
  planId: string;
  backupsEnabled: boolean;
  backupFrequency?: "daily" | "weekly" | "none";
  onBackupsChange: (enabled: boolean) => void;
  onFrequencyChange: (frequency: "daily" | "weekly" | "none") => void;
  token: string;
}

export const BackupConfiguration: React.FC<BackupConfigurationProps> = ({
  planId,
  backupsEnabled,
  onBackupsChange,
  onFrequencyChange,
  token,
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
        const res = await fetch("/api/vps/plans", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch plans");
        }

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
  }, [planId, token]);

  // Calculate backup pricing - single flat rate (Linode backups are daily at one price)
  const baseBackupPrice = toCurrencyNumber(plan?.backup_price_monthly);
  const backupMarkup = toCurrencyNumber(plan?.backup_upcharge_monthly);
  const backupCostMonthly = baseBackupPrice + backupMarkup;

  // Sync frequency with enabled state (always use 'weekly' internally for compatibility)
  useEffect(() => {
    if (backupsEnabled) {
      onFrequencyChange("weekly"); // Use 'weekly' as the standard enabled state
    } else {
      onFrequencyChange("none");
    }
  }, [backupsEnabled, onFrequencyChange]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium text-foreground">Backups</Label>
        </div>
        <div className="text-sm text-muted-foreground">Loading backup options...</div>
      </div>
    );
  }

  if (!plan) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Enable/Disable Backups */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={backupsEnabled}
          onChange={(e) => onBackupsChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 text-primary focus:ring-primary border rounded"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
              Enable Backups
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Automatic daily backups of your server
          </p>
        </div>
      </label>

      {/* Backup Pricing Info */}
      {backupsEnabled && (
        <div className="ml-7 space-y-3 pl-4 border-l-2 border-primary/20">
          {/* Backup Details */}
          <div className="rounded-lg bg-muted p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  Daily Automatic Backups
                </span>
              </div>
              <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
                <DollarSign className="h-3.5 w-3.5" />
                <span>{backupCostMonthly.toFixed(2)}/mo</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Your server is backed up automatically every day
            </p>
          </div>

          {/* Backup Pricing Breakdown */}
          {(baseBackupPrice > 0 || backupMarkup > 0) && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Provider backup cost:</span>
                <span className="font-medium text-foreground">
                  ${baseBackupPrice.toFixed(2)}/mo
                </span>
              </div>
              {backupMarkup > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Platform fee:</span>
                  <span className="font-medium text-foreground">
                    ${backupMarkup.toFixed(2)}/mo
                  </span>
                </div>
              )}
              <div className="pt-1.5 border-t border-border flex items-center justify-between text-xs font-semibold">
                <span className="text-foreground">Total backup cost:</span>
                <span className="text-primary">
                  ${backupCostMonthly.toFixed(2)}/mo
                </span>
              </div>
            </div>
          )}

          {/* Info note */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Backups include 3 automatic daily snapshots and 1 manual snapshot slot.
              You can restore from any backup at any time.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
