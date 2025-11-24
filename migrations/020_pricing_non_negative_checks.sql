-- Migration 020: Add non-negative CHECK constraints for PaaS pricing tables
-- This enforces basic business rules at the database level so that
-- pricing-related numeric fields cannot be negative.

-- Ensure monthly and per-resource pricing values are non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'paas_pricing_plans_monthly_price_non_negative'
      AND table_name = 'paas_pricing_plans'
  ) THEN
    ALTER TABLE paas_pricing_plans
      ADD CONSTRAINT paas_pricing_plans_monthly_price_non_negative
        CHECK (monthly_price IS NULL OR monthly_price >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'paas_pricing_plans_price_per_cpu_hour_non_negative'
      AND table_name = 'paas_pricing_plans'
  ) THEN
    ALTER TABLE paas_pricing_plans
      ADD CONSTRAINT paas_pricing_plans_price_per_cpu_hour_non_negative
        CHECK (price_per_cpu_hour IS NULL OR price_per_cpu_hour >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'paas_pricing_plans_price_per_ram_gb_hour_non_negative'
      AND table_name = 'paas_pricing_plans'
  ) THEN
    ALTER TABLE paas_pricing_plans
      ADD CONSTRAINT paas_pricing_plans_price_per_ram_gb_hour_non_negative
        CHECK (price_per_ram_gb_hour IS NULL OR price_per_ram_gb_hour >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'paas_pricing_plans_price_per_disk_gb_month_non_negative'
      AND table_name = 'paas_pricing_plans'
  ) THEN
    ALTER TABLE paas_pricing_plans
      ADD CONSTRAINT paas_pricing_plans_price_per_disk_gb_month_non_negative
        CHECK (price_per_disk_gb_month IS NULL OR price_per_disk_gb_month >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'paas_pricing_plans_price_per_bandwidth_gb_non_negative'
      AND table_name = 'paas_pricing_plans'
  ) THEN
    ALTER TABLE paas_pricing_plans
      ADD CONSTRAINT paas_pricing_plans_price_per_bandwidth_gb_non_negative
        CHECK (price_per_bandwidth_gb IS NULL OR price_per_bandwidth_gb >= 0);
  END IF;

  -- Resource limits should also be non-negative when present
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'paas_pricing_plans_cpu_cores_non_negative'
      AND table_name = 'paas_pricing_plans'
  ) THEN
    ALTER TABLE paas_pricing_plans
      ADD CONSTRAINT paas_pricing_plans_cpu_cores_non_negative
        CHECK (cpu_cores IS NULL OR cpu_cores >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'paas_pricing_plans_ram_mb_non_negative'
      AND table_name = 'paas_pricing_plans'
  ) THEN
    ALTER TABLE paas_pricing_plans
      ADD CONSTRAINT paas_pricing_plans_ram_mb_non_negative
        CHECK (ram_mb IS NULL OR ram_mb >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'paas_pricing_plans_disk_gb_non_negative'
      AND table_name = 'paas_pricing_plans'
  ) THEN
    ALTER TABLE paas_pricing_plans
      ADD CONSTRAINT paas_pricing_plans_disk_gb_non_negative
        CHECK (disk_gb IS NULL OR disk_gb >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'paas_pricing_plans_bandwidth_gb_non_negative'
      AND table_name = 'paas_pricing_plans'
  ) THEN
    ALTER TABLE paas_pricing_plans
      ADD CONSTRAINT paas_pricing_plans_bandwidth_gb_non_negative
        CHECK (bandwidth_gb IS NULL OR bandwidth_gb >= 0);
  END IF;
END;
$$;

-- Ensure addon pricing numeric values are non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'paas_addon_pricing_monthly_price_non_negative'
      AND table_name = 'paas_addon_pricing'
  ) THEN
    ALTER TABLE paas_addon_pricing
      ADD CONSTRAINT paas_addon_pricing_monthly_price_non_negative
        CHECK (monthly_price >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'paas_addon_pricing_storage_gb_non_negative'
      AND table_name = 'paas_addon_pricing'
  ) THEN
    ALTER TABLE paas_addon_pricing
      ADD CONSTRAINT paas_addon_pricing_storage_gb_non_negative
        CHECK (storage_gb IS NULL OR storage_gb >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'paas_addon_pricing_max_connections_non_negative'
      AND table_name = 'paas_addon_pricing'
  ) THEN
    ALTER TABLE paas_addon_pricing
      ADD CONSTRAINT paas_addon_pricing_max_connections_non_negative
        CHECK (max_connections IS NULL OR max_connections >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'paas_addon_pricing_ram_mb_non_negative'
      AND table_name = 'paas_addon_pricing'
  ) THEN
    ALTER TABLE paas_addon_pricing
      ADD CONSTRAINT paas_addon_pricing_ram_mb_non_negative
        CHECK (ram_mb IS NULL OR ram_mb >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'paas_addon_pricing_cpu_cores_non_negative'
      AND table_name = 'paas_addon_pricing'
  ) THEN
    ALTER TABLE paas_addon_pricing
      ADD CONSTRAINT paas_addon_pricing_cpu_cores_non_negative
        CHECK (cpu_cores IS NULL OR cpu_cores >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'paas_addon_pricing_backup_retention_non_negative'
      AND table_name = 'paas_addon_pricing'
  ) THEN
    ALTER TABLE paas_addon_pricing
      ADD CONSTRAINT paas_addon_pricing_backup_retention_non_negative
        CHECK (backup_retention_days IS NULL OR backup_retention_days >= 0);
  END IF;
END;
$$;
