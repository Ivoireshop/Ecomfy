CREATE OR REPLACE FUNCTION public.notify_new_order_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := 'https://yfggrceynzcwklbxhgix.supabase.co/functions/v1/send-push-notification';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmZ2dyY2V5bnpjd2tsYnhoZ2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMjE2MDYsImV4cCI6MjEwMTY5NzYwNn0.6BwTng1U_reE09Fn4LACrFkkETV6gRTfoxTUe3eH4Ys';
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
