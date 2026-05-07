/*
  # Embed Credentials

  Stores username/password pairs for accessing the embeddable marketplace.
  Each credential is tied to an application (app_id) and a SendCraft user.
  Passwords are stored as SHA-256 hex hashes (client-side hashed before insert).

  1. New Tables
    - `embed_credentials`
      - `id` (uuid, pk)
      - `user_id` (uuid) — SendCraft user who owns this credential
      - `app_id` (uuid) — Application this credential is linked to
      - `username` (text) — Login username for the embed
      - `password_hash` (text) — SHA-256 hash of the password
      - `label` (text) — Friendly label, e.g. "CRM Principal"
      - `is_active` (boolean)
      - `last_used_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled; only the owning user can read/write their credentials
*/

CREATE TABLE IF NOT EXISTS embed_credentials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id        uuid,
  username      text NOT NULL,
  password_hash text NOT NULL,
  label         text NOT NULL DEFAULT '',
  is_active     boolean NOT NULL DEFAULT true,
  last_used_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, username)
);

ALTER TABLE embed_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select own embed credentials"
  ON embed_credentials FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert own embed credentials"
  ON embed_credentials FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update own embed credentials"
  ON embed_credentials FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can delete own embed credentials"
  ON embed_credentials FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_embed_credentials_user_id ON embed_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_embed_credentials_username ON embed_credentials(username);
