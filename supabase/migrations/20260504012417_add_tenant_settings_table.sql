/*
  # Create tenant_settings table

  ## Purpose
  Store tenant-level configuration that applies across all users of a tenant.

  ## New Tables
  - `tenant_settings`
    - `id` (uuid, primary key)
    - `tenant_id` (text, unique) — matches the tenant_id used throughout the app
    - `subscription_return_url` (text, nullable) — URL where MercadoPago redirects after a successful subscription
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - SELECT: authenticated users can read their own tenant's settings
  - INSERT: authenticated users can insert settings for their own tenant
  - UPDATE: authenticated users can update settings for their own tenant
  - DELETE: authenticated users can delete settings for their own tenant

  ## Notes
  - One row per tenant_id
  - subscription_return_url is optional; if not set, the app falls back to window.location.origin
*/

CREATE TABLE IF NOT EXISTS tenant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text UNIQUE NOT NULL,
  subscription_return_url text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read their tenant settings"
  ON tenant_settings FOR SELECT
  TO authenticated
  USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id'));

CREATE POLICY "Tenant members can insert their tenant settings"
  ON tenant_settings FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id'));

CREATE POLICY "Tenant members can update their tenant settings"
  ON tenant_settings FOR UPDATE
  TO authenticated
  USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id'))
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id'));

CREATE POLICY "Tenant members can delete their tenant settings"
  ON tenant_settings FOR DELETE
  TO authenticated
  USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id'));
