
CREATE OR REPLACE FUNCTION public.get_my_subscription_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.subscriptions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status','inactive','expired',false);
  END IF;

  SELECT * INTO v_row FROM public.subscriptions WHERE user_id = v_uid LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','inactive','expired',false);
  END IF;

  IF v_row.status = 'active'
     AND v_row.end_date IS NOT NULL
     AND v_row.end_date < now() THEN
    UPDATE public.subscriptions
       SET status = 'inactive', updated_at = now()
     WHERE id = v_row.id;
    v_row.status := 'inactive';
    RETURN jsonb_build_object(
      'status','inactive',
      'expired', true,
      'end_date', v_row.end_date,
      'video_generations_remaining', v_row.video_generations_remaining
    );
  END IF;

  RETURN jsonb_build_object(
    'status', v_row.status,
    'expired', false,
    'end_date', v_row.end_date,
    'start_date', v_row.start_date,
    'video_generations_remaining', v_row.video_generations_remaining
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_subscription_status() TO authenticated;
