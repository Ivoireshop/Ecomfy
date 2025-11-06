-- Add INSERT policy for profiles table as backup to handle_new_user trigger
-- This provides defense-in-depth: if the trigger fails, users can still create their own profile
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);