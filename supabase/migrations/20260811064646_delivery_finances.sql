-- 1. Create delivery_driver_sessions table
CREATE TABLE IF NOT EXISTS public.delivery_driver_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.delivery_company_members(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'reconciled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create delivery_payments table
CREATE TABLE IF NOT EXISTS public.delivery_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL UNIQUE REFERENCES public.order_deliveries(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.delivery_driver_sessions(id) ON DELETE SET NULL,
  amount_collected numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  status text NOT NULL DEFAULT 'collected_by_driver' CHECK (status IN ('collected_by_driver', 'remitted_to_company', 'remitted_to_shop')),
  collected_at timestamptz NOT NULL DEFAULT now(),
  remitted_to_company_at timestamptz,
  remitted_to_shop_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_driver_sessions TO authenticated;
GRANT ALL ON public.delivery_driver_sessions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_payments TO authenticated;
GRANT ALL ON public.delivery_payments TO service_role;

-- 4. Enable RLS
ALTER TABLE public.delivery_driver_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_payments ENABLE ROW LEVEL SECURITY;

-- 5. Policies for delivery_driver_sessions
CREATE POLICY "Drivers can view their sessions"
  ON public.delivery_driver_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_company_members dcm
      WHERE dcm.id = delivery_driver_sessions.driver_id AND dcm.user_id = auth.uid()
    )
  );

CREATE POLICY "Provider admins can view and manage sessions"
  ON public.delivery_driver_sessions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_company_members driver
      JOIN public.delivery_company_members admin ON admin.provider_id = driver.provider_id
      WHERE driver.id = delivery_driver_sessions.driver_id AND admin.user_id = auth.uid() AND admin.role IN ('admin', 'dispatcher', 'cashier')
    ) OR EXISTS (
      SELECT 1 FROM public.delivery_company_members driver
      JOIN public.delivery_providers dp ON dp.id = driver.provider_id
      WHERE driver.id = delivery_driver_sessions.driver_id AND dp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.delivery_company_members driver
      JOIN public.delivery_company_members admin ON admin.provider_id = driver.provider_id
      WHERE driver.id = delivery_driver_sessions.driver_id AND admin.user_id = auth.uid() AND admin.role IN ('admin', 'dispatcher', 'cashier')
    ) OR EXISTS (
      SELECT 1 FROM public.delivery_company_members driver
      JOIN public.delivery_providers dp ON dp.id = driver.provider_id
      WHERE driver.id = delivery_driver_sessions.driver_id AND dp.user_id = auth.uid()
    )
  );

-- 6. Policies for delivery_payments
CREATE POLICY "Drivers can view payments for their sessions"
  ON public.delivery_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_driver_sessions dds
      JOIN public.delivery_company_members dcm ON dcm.id = dds.driver_id
      WHERE dds.id = delivery_payments.session_id AND dcm.user_id = auth.uid()
    )
  );

CREATE POLICY "Provider admins can view and manage payments"
  ON public.delivery_payments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_deliveries od
      JOIN public.delivery_company_members admin ON admin.provider_id = od.provider_id
      WHERE od.id = delivery_payments.delivery_id AND admin.user_id = auth.uid() AND admin.role IN ('admin', 'cashier')
    ) OR EXISTS (
      SELECT 1 FROM public.order_deliveries od
      JOIN public.delivery_providers dp ON dp.id = od.provider_id
      WHERE od.id = delivery_payments.delivery_id AND dp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.order_deliveries od
      JOIN public.delivery_company_members admin ON admin.provider_id = od.provider_id
      WHERE od.id = delivery_payments.delivery_id AND admin.user_id = auth.uid() AND admin.role IN ('admin', 'cashier')
    ) OR EXISTS (
      SELECT 1 FROM public.order_deliveries od
      JOIN public.delivery_providers dp ON dp.id = od.provider_id
      WHERE od.id = delivery_payments.delivery_id AND dp.user_id = auth.uid()
    )
  );

-- 7. Triggers for updated_at
CREATE TRIGGER delivery_driver_sessions_set_updated_at
  BEFORE UPDATE ON public.delivery_driver_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER delivery_payments_set_updated_at
  BEFORE UPDATE ON public.delivery_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
