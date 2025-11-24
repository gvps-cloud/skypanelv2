-- Migration: PaaS Locations
-- Description: Create table for managing PaaS datacenter locations and add location foreign key to worker nodes
-- This migration creates a new paas_locations table to store datacenter information including
-- region, country, and unique datacenter codes. It also adds a location_id foreign key to the
-- paas_worker_nodes table to associate workers with specific locations.

-- Create paas_locations table
-- This table stores datacenter location information that can be assigned to PaaS worker nodes.
-- Each location represents a physical or logical datacenter with identifiable region, country,
-- and unique datacenter code for infrastructure management.
CREATE TABLE IF NOT EXISTS paas_locations (
    id SERIAL PRIMARY KEY,
    
    -- Location identification
    name VARCHAR(255) NOT NULL, -- Human-readable location name (e.g., "New York Datacenter 1")
    datacenter_code VARCHAR(50) NOT NULL UNIQUE, -- Unique code for this datacenter (e.g., "us-nyc-01")
    
    -- Geographic information
    region VARCHAR(100) NOT NULL, -- Region slug (e.g., "us-east", "eu-west")
    country VARCHAR(100) NOT NULL, -- Country name or ISO code (e.g., "United States", "US")
    
    -- Additional information
    description TEXT, -- Optional description of the location
    
    -- Flexible metadata storage
    metadata JSONB DEFAULT '{}', -- Store additional location-specific data
    
    -- Status
    is_active BOOLEAN DEFAULT true, -- Whether this location is available for new worker assignments
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER -- User ID who created this location
);

-- Create indexes for efficient querying
CREATE INDEX idx_paas_locations_datacenter_code ON paas_locations(datacenter_code);
CREATE INDEX idx_paas_locations_region ON paas_locations(region);
CREATE INDEX idx_paas_locations_country ON paas_locations(country);
CREATE INDEX idx_paas_locations_is_active ON paas_locations(is_active);
CREATE INDEX idx_paas_locations_created_at ON paas_locations(created_at);

-- Add location_id foreign key to paas_worker_nodes
-- This links each worker node to a specific datacenter location.
-- The column is nullable to allow gradual migration of existing workers.
ALTER TABLE paas_worker_nodes 
ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES paas_locations(id) ON DELETE SET NULL;

-- Create index for location_id foreign key
CREATE INDEX IF NOT EXISTS idx_paas_workers_location_id ON paas_worker_nodes(location_id);

-- Updated timestamp trigger for paas_locations
CREATE OR REPLACE FUNCTION update_paas_locations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_paas_locations_timestamp
    BEFORE UPDATE ON paas_locations
    FOR EACH ROW
    EXECUTE FUNCTION update_paas_locations_timestamp();

-- Comments for documentation
COMMENT ON TABLE paas_locations IS 'Datacenter locations where PaaS worker nodes can be deployed';
COMMENT ON COLUMN paas_locations.name IS 'Human-readable name of the datacenter location';
COMMENT ON COLUMN paas_locations.datacenter_code IS 'Unique identifier code for the datacenter (e.g., us-nyc-01)';
COMMENT ON COLUMN paas_locations.region IS 'Geographic region slug (e.g., us-east, eu-west, ap-south)';
COMMENT ON COLUMN paas_locations.country IS 'Country name or ISO code where the datacenter is located';
COMMENT ON COLUMN paas_locations.description IS 'Optional detailed description of the location';
COMMENT ON COLUMN paas_locations.metadata IS 'Additional location-specific data in JSON format';
COMMENT ON COLUMN paas_locations.is_active IS 'Whether this location is currently available for new worker assignments';
COMMENT ON COLUMN paas_worker_nodes.location_id IS 'Foreign key reference to the datacenter location where this worker is deployed';

-- Optional: Migrate existing region data from paas_worker_nodes to paas_locations
-- This script attempts to create location entries from existing worker region data
-- Uncomment the following block if you want to auto-migrate existing data:

/*
DO $$
DECLARE
    region_record RECORD;
    new_location_id INTEGER;
BEGIN
    -- Find distinct regions from existing workers
    FOR region_record IN 
        SELECT DISTINCT region 
        FROM paas_worker_nodes 
        WHERE region IS NOT NULL AND region != ''
    LOOP
        -- Create a location entry for this region if it doesn't exist
        INSERT INTO paas_locations (name, datacenter_code, region, country, description, created_at, updated_at)
        VALUES (
            region_record.region, -- Use region as name initially
            LOWER(REPLACE(region_record.region, ' ', '-')), -- Generate datacenter_code from region
            region_record.region, -- Use region as-is
            'Unknown', -- Country needs to be set manually
            'Auto-migrated from existing worker region data',
            NOW(),
            NOW()
        )
        ON CONFLICT (datacenter_code) DO NOTHING
        RETURNING id INTO new_location_id;
        
        -- Update workers with this region to reference the new location
        IF new_location_id IS NOT NULL THEN
            UPDATE paas_worker_nodes 
            SET location_id = new_location_id 
            WHERE region = region_record.region AND location_id IS NULL;
        END IF;
    END LOOP;
END $$;
*/
