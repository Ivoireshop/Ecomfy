-- Add free video generations tracking to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS free_video_generations_remaining integer NOT NULL DEFAULT 1;

-- Create trigger to automatically generate referral code when user signs up
CREATE OR REPLACE TRIGGER on_user_created_generate_referral
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_referral_code();

-- Update handle_new_user to set free_video_generations_remaining
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Insert profile with phone, country, free generations and free video generations
  INSERT INTO public.profiles (id, email, full_name, phone, country, free_generations_remaining, free_video_generations_remaining)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'country',
    3,
    1
  );
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  -- Create inactive subscription
  INSERT INTO public.subscriptions (user_id, status)
  VALUES (NEW.id, 'inactive');
  
  RETURN NEW;
END;
$function$;