-- Add free_generations_remaining column to profiles
ALTER TABLE public.profiles 
ADD COLUMN free_generations_remaining INTEGER NOT NULL DEFAULT 3;

-- Update the handle_new_user function to initialize free generations
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile with phone, country and free generations
  INSERT INTO public.profiles (id, email, full_name, phone, country, free_generations_remaining)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'country',
    3
  );
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  -- Create inactive subscription
  INSERT INTO public.subscriptions (user_id, status)
  VALUES (NEW.id, 'inactive');
  
  RETURN NEW;
END;
$$;

-- Add RLS policy to allow users to update their own free_generations_remaining
CREATE POLICY "Users can update their free generations" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);