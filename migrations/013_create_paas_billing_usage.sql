-- Migration: PaaS Billing Usage
-- Description: Track resource usage for billing

CREATE TABLE IF NOT EXISTS paas_billing_usage (
    id SERIAL PRIMARY KEY,
    
    -- Application Reference
    application_id INTEGER NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL, -- References users(id)
    
    -- Billing Period
    billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Resource Usage
    cpu_core_hours DECIMAL(15,4) DEFAULT 0, -- Total CPU core hours
    ram_gb_hours DECIMAL(15,4) DEFAULT 0, -- Total RAM GB hours
    disk_gb_days DECIMAL(15,4) DEFAULT 0, -- Total disk GB days
    bandwidth_gb DECIMAL(15,4) DEFAULT 0, -- Total outbound bandwidth GB
    
    -- Time-based tracking
    running_hours DECIMAL(10,2) DEFAULT 0, -- Hours application was running
    
    -- Pricing Applied
    pricing_plan_id INTEGER REFERENCES paas_pricing_plans(id),
    pricing_snapshot JSONB, -- Snapshot of pricing at billing time
    
    -- Calculated Costs
    cpu_cost DECIMAL(10,2) DEFAULT 0,
    ram_cost DECIMAL(10,2) DEFAULT 0,
    disk_cost DECIMAL(10,2) DEFAULT 0,
    bandwidth_cost DECIMAL(10,2) DEFAULT 0,
    addon_costs DECIMAL(10,2) DEFAULT 0,
    total_cost DECIMAL(10,2) DEFAULT 0,
    
    -- Billing Status
    is_invoiced BOOLEAN DEFAULT false,
    invoice_id VARCHAR(255), -- Reference to invoice system
    
    -- Metadata
    notes TEXT,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_billing_period CHECK (billing_period_end > billing_period_start)
);

-- Indexes
CREATE INDEX idx_paas_billing_application ON paas_billing_usage(application_id);
CREATE INDEX idx_paas_billing_user ON paas_billing_usage(user_id);
CREATE INDEX idx_paas_billing_period_start ON paas_billing_usage(billing_period_start);
CREATE INDEX idx_paas_billing_period_end ON paas_billing_usage(billing_period_end);
CREATE INDEX idx_paas_billing_invoiced ON paas_billing_usage(is_invoiced);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_paas_billing_usage_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_paas_billing_usage_timestamp
    BEFORE UPDATE ON paas_billing_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_paas_billing_usage_timestamp();

-- Comments
COMMENT ON TABLE paas_billing_usage IS 'Resource usage tracking for billing calculations';
COMMENT ON COLUMN paas_billing_usage.cpu_core_hours IS 'Total CPU core hours consumed';
COMMENT ON COLUMN paas_billing_usage.ram_gb_hours IS 'Total RAM GB hours consumed';
COMMENT ON COLUMN paas_billing_usage.pricing_snapshot IS 'Snapshot of pricing rates at billing time';
