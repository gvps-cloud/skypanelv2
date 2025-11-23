-- Migration: Add foreign key for pricing plan in paas_applications
-- Description: Link applications to pricing plans

DO $$
BEGIN
    -- Add foreign key constraint for pricing_plan_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'paas_applications_pricing_plan_fkey' 
        AND table_name = 'paas_applications'
    ) THEN
        ALTER TABLE paas_applications
        ADD CONSTRAINT paas_applications_pricing_plan_fkey
        FOREIGN KEY (pricing_plan_id) REFERENCES paas_pricing_plans(id) ON DELETE SET NULL;
    END IF;

    -- Add foreign key constraint for addon_pricing_id in paas_addons
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'paas_addons_addon_pricing_fkey' 
        AND table_name = 'paas_addons'
    ) THEN
        ALTER TABLE paas_addons
        ADD CONSTRAINT paas_addons_addon_pricing_fkey
        FOREIGN KEY (addon_pricing_id) REFERENCES paas_addon_pricing(id) ON DELETE SET NULL;
    END IF;
END $$;
