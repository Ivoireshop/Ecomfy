
-- Restrict UPDATE privileges on profiles to non-sensitive columns only for authenticated users.
-- Sensitive fields (credits, generations, paid flags, email) can only be modified by service_role.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, phone, country, preferred_language, onboarding_completed) ON public.profiles TO authenticated;

-- Drop the redundant "free generations" self-update policy (column no longer grantable to authenticated).
DROP POLICY IF EXISTS "Users can update their free generations" ON public.profiles;

-- Subscriptions must never be self-mutated by users; only service_role (via webhooks/edge functions) updates.
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.subscriptions;
REVOKE UPDATE, INSERT, DELETE ON public.subscriptions FROM authenticated;
-- Keep SELECT for users on their own row (existing policy remains).
