-- Migration: Fix PaaS Application Status Constraint
-- Description: Add 'deleted' to valid status values for paas_applications

ALTER TABLE paas_applications DROP CONSTRAINT valid_status;

ALTER TABLE paas_applications 
    ADD CONSTRAINT valid_status 
    CHECK (status IN ('inactive', 'deploying', 'running', 'stopped', 'error', 'deleting', 'deleted'));
