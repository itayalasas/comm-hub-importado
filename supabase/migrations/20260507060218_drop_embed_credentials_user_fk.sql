/*
  # Drop foreign key constraint on embed_credentials.user_id

  The app uses an external auth system — user IDs do not exist in auth.users.
  Removing the FK so any external user_id can be stored freely.
*/

ALTER TABLE embed_credentials DROP CONSTRAINT IF EXISTS embed_credentials_user_id_fkey;
