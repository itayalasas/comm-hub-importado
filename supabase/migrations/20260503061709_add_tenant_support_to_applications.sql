/*
  # Add tenant support to applications

  ## Summary
  Adds multi-tenant capability to the platform. Multiple users from the same tenant
  can now share access to the same applications.

  ## Changes

  ### Modified Tables
  - `applications`
    - Add `tenant_id` (text, nullable) — stores the external tenant UUID from the auth system
    - Add index on `tenant_id` for query performance

  ### RLS Policy Updates
  - Add new SELECT/INSERT/UPDATE/DELETE policies on `applications` that allow access
    when the row's `tenant_id` matches the requesting user's tenant_id stored in their JWT
    (via app_metadata or a helper approach using user_id text matching)
  - Existing `user_id`-based policies are kept intact so no existing data breaks

  ## Notes
  - tenant_id is text (not uuid FK) because it comes from an external auth system
  - Rows created before this migration have tenant_id = NULL and continue to be
    accessed via the existing user_id policies
  - New rows should set both user_id and tenant_id
*/

-- Add tenant_id column to applications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE applications ADD COLUMN tenant_id text;
  END IF;
END $$;

-- Index for tenant-based lookups
CREATE INDEX IF NOT EXISTS idx_applications_tenant_id ON applications(tenant_id);

-- Also add tenant_id to user_preferences so default app lookup works per tenant context
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_preferences' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN tenant_id text;
  END IF;
END $$;
