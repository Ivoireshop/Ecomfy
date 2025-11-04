-- Add INSERT policy for payments table that only allows service role
-- This prevents users from creating fraudulent payment records
-- Only backend functions with service role can insert payments

CREATE POLICY "Only backend can insert payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Note: Service role bypasses RLS, so edge functions can still insert payments