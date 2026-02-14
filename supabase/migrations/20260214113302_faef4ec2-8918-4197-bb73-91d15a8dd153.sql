-- Allow founders to view all subscriptions for dashboard
CREATE POLICY "Founders can view all subscriptions"
ON public.subscriptions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('founder', 'co_founder')
  )
);

-- Allow founders to view all payments for dashboard
CREATE POLICY "Founders can view all payments"
ON public.payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('founder', 'co_founder')
  )
);