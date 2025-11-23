-- Migration: Fix PaaS Application User ID Type
-- Description: Change user_id from INTEGER to UUID to match users table

-- Drop the foreign key constraint first if it exists (it might not have been created successfully due to type mismatch, or it might be there)
ALTER TABLE paas_applications DROP CONSTRAINT IF EXISTS paas_applications_user_id_fkey;

-- Change the column type
ALTER TABLE paas_applications 
  ALTER COLUMN user_id TYPE UUID USING user_id::text::uuid;

-- Re-add the foreign key constraint
ALTER TABLE paas_applications
  ADD CONSTRAINT paas_applications_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
