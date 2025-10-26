/*
  # Remove foreign key constraint from user_preferences
  
  This application uses external authentication, not Supabase Auth.
  The user_id values come from an external auth provider and don't exist in auth.users table.
  
  1. Changes
    - Drop foreign key constraint user_preferences_user_id_fkey
    - Keep user_id column as UUID for application-level tracking
    - No data loss, only removes the constraint
*/

ALTER TABLE user_preferences 
DROP CONSTRAINT IF EXISTS user_preferences_user_id_fkey;
