-- ====================================================================
-- ECOMFY PROFILE COMPLETION SYSTEM (GOOGLE OAUTH & USER ENRICHMENT)
-- ====================================================================

-- Add columns to profiles table if they don't exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_consent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT false;

-- Backfill profile_completed for pre-existing users who already have a phone number
UPDATE public.profiles
SET profile_completed = true
WHERE phone IS NOT NULL AND TRIM(phone) != '';

-- Update handle_new_user trigger to handle Google OAuth vs Classic Signup cleanly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_phone TEXT;
  v_country TEXT;
  v_completed BOOLEAN := false;
BEGIN
  -- Extract metadata provided by auth provider or classic signup form
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '');
  v_first_name := COALESCE(NEW.raw_user_meta_data->>'given_name', NEW.raw_user_meta_data->>'first_name', '');
  v_last_name := COALESCE(NEW.raw_user_meta_data->>'family_name', NEW.raw_user_meta_data->>'last_name', '');
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_country := NEW.raw_user_meta_data->>'country';

  -- If full_name is set but first_name/last_name are missing, split full_name
  IF v_full_name != '' AND (v_first_name = '' OR v_first_name IS NULL) THEN
    v_first_name := SPLIT_PART(v_full_name, ' ', 1);
    v_last_name := SUBSTRING(v_full_name FROM LENGTH(v_first_name) + 2);
  END IF;

  -- Profile is considered completed automatically if phone is provided on signup (classic signup)
  IF v_phone IS NOT NULL AND TRIM(v_phone) != '' THEN
    v_completed := true;
  END IF;

  -- Insert profile record
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    first_name,
    last_name,
    phone,
    country,
    avatar_url,
    profile_completed
  ) VALUES (
    NEW.id,
    NEW.email,
    NULLIF(v_full_name, ''),
    NULLIF(v_first_name, ''),
    NULLIF(v_last_name, ''),
    v_phone,
    v_country,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    v_completed
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    updated_at = NOW();

  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Create inactive subscription record if none exists
  INSERT INTO public.subscriptions (user_id, status)
  VALUES (NEW.id, 'inactive')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
