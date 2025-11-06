-- Create referrals table to track referral relationships
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  bonus_generations INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(referrer_id, referred_id)
);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Users can view their own referrals (as referrer)
CREATE POLICY "Users can view their own referrals"
ON public.referrals FOR SELECT
USING (auth.uid() = referrer_id);

-- Users can view referrals where they are referred
CREATE POLICY "Users can view referrals where they are referred"
ON public.referrals FOR SELECT
USING (auth.uid() = referred_id);

-- System can insert referrals
CREATE POLICY "System can insert referrals"
ON public.referrals FOR INSERT
WITH CHECK (true);

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code TEXT;
  code_exists BOOLEAN;
BEGIN
  -- Generate a unique 8-character code
  LOOP
    code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || user_id::TEXT) FROM 1 FOR 8));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM referrals WHERE referral_code = code) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN code;
END;
$$;

-- Function to process referral signup
CREATE OR REPLACE FUNCTION public.process_referral_signup(referred_user_id UUID, referral_code_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_user_id UUID;
  bonus_gens INTEGER;
BEGIN
  -- Find the referral by code
  SELECT referrer_id, bonus_generations 
  INTO referrer_user_id, bonus_gens
  FROM referrals 
  WHERE referral_code = UPPER(referral_code_input) 
    AND status = 'pending'
  LIMIT 1;
  
  -- If no valid referral found, return false
  IF referrer_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Update referral status
  UPDATE referrals 
  SET 
    referred_id = referred_user_id,
    status = 'completed',
    completed_at = now()
  WHERE referral_code = UPPER(referral_code_input)
    AND status = 'pending';
  
  -- Give bonus generations to referrer
  UPDATE profiles
  SET free_generations_remaining = free_generations_remaining + bonus_gens
  WHERE id = referrer_user_id;
  
  -- Give bonus generations to new user (welcome bonus)
  UPDATE profiles
  SET free_generations_remaining = free_generations_remaining + 2
  WHERE id = referred_user_id;
  
  RETURN true;
END;
$$;

-- Trigger to create referral code for new users
CREATE OR REPLACE FUNCTION public.create_user_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
BEGIN
  -- Generate unique code
  new_code := generate_referral_code(NEW.id);
  
  -- Insert referral entry
  INSERT INTO public.referrals (referrer_id, referral_code, status)
  VALUES (NEW.id, new_code, 'pending');
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
CREATE TRIGGER on_user_create_referral_code
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_referral_code();

-- Create index for faster lookups
CREATE INDEX idx_referrals_code ON public.referrals(referral_code);
CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX idx_referrals_status ON public.referrals(status);