-- 027: Remove transfer multiplier, add transfer alert template and alert log table

-- Convert any existing multiplier plans to flat with zero markup
UPDATE vps_plans
SET transfer_overage_markup_type = 'flat',
    transfer_overage_markup_value = 0
WHERE transfer_overage_markup_type = 'multiplier';

-- Create transfer alert deduplication log
CREATE TABLE IF NOT EXISTS transfer_alert_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month DATE NOT NULL,
  threshold_percent INT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (period_month, threshold_percent)
);

-- Add transfer quota warning email template
INSERT INTO email_templates (name, subject, html_body, text_body) VALUES
(
  'transfer_quota_warning',
  '⚠️ {{companyName}} Transfer Pool Alert: {{usagePercent}}% Used',
  '<div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto;"><p>Hi {{displayName}},</p><p>Your {{companyName}} account transfer pool is approaching its monthly limit.</p><div style="border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 16px 0; background-color: #fffbeb;"><p style="margin: 0 0 8px 0; font-weight: 700; color: #92400e;">Transfer Pool Status</p><p style="margin: 0 0 4px 0;"><strong>Used:</strong> {{usedGb}} GB of {{quotaGb}} GB ({{usagePercent}}%)</p><p style="margin: 0 0 4px 0;"><strong>Billable Overage:</strong> {{billableGb}} GB</p><p style="margin: 0 0 4px 0;"><strong>Projected Provider Cost:</strong> ${{projectedProviderCost}}</p><p style="margin: 0;"><strong>Period:</strong> {{periodMonth}}</p></div><p>Overage charges of <strong>${{providerRatePerGb}}/GB</strong> will apply to usage beyond the included pool quota.</p><p style="color: #4b5563; font-size: 14px;">You can review detailed transfer usage in the admin panel under Transfer &amp; Egress.</p><p>Thanks,<br/><strong>The {{companyName}} Team</strong></p></div>',
  'Hi {{displayName}},

Your {{companyName}} account transfer pool is approaching its monthly limit.

Transfer Pool Status:
- Used: {{usedGb}} GB of {{quotaGb}} GB ({{usagePercent}}%)
- Billable Overage: {{billableGb}} GB
- Projected Provider Cost: ${{projectedProviderCost}}
- Period: {{periodMonth}}

Overage charges of ${{providerRatePerGb}}/GB will apply to usage beyond the included pool quota.

You can review detailed transfer usage in the admin panel under Transfer & Egress.

Thanks,
The {{companyName}} Team'
)
ON CONFLICT (name) DO NOTHING;
