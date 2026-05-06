CREATE TABLE public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  fcm_token text NOT NULL UNIQUE,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_device_tokens_user ON public.device_tokens(user_id);
CREATE INDEX idx_device_tokens_shop ON public.device_tokens(shop_id);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tokens" ON public.device_tokens
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_device_tokens_updated_at
  BEFORE UPDATE ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: notify push on new order via pg_net to edge function
CREATE OR REPLACE FUNCTION public.notify_new_order_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := 'https://dqlbmtkaamjohgbcjwtw.supabase.co/functions/v1/send-push-notification';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxbGJtdGthYW1qb2hnYmNqd3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMTMyNTAsImV4cCI6MjA3NzY4OTI1MH0.Y74c0ym91Q29oW6C-F5g8rBF8y4AphYtB4KJtu1AOLg';
BEGIN
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_anon),
    body := jsonb_build_object(
      'order_id', NEW.id,
      'shop_id', NEW.shop_id,
      'customer_name', NEW.customer_name,
      'total', NEW.total,
      'order_number', NEW.order_number
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_order_push
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_order_push();