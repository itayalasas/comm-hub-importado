/*
  # Disable RLS for user_preferences table
  
  Since this application uses external authentication (not Supabase Auth),
  auth.uid() returns NULL and RLS policies fail. 
  
  User preferences only store non-sensitive data (default application selection),
  and access control is handled at the application level using user_id matching.
  
  1. Changes
    - Disable RLS on user_preferences table
    - Keep the user_id column for application-level access control
*/

ALTER TABLE user_preferences DISABLE ROW LEVEL SECURITY;
