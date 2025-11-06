-- Create promo_codes table
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_percentage INTEGER NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  max_uses INTEGER NOT NULL CHECK (max_uses > 0),
  current_uses INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index on code for faster lookups
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON public.promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_created_by ON public.promo_codes(created_by);

-- Enable Row Level Security
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Founders and co-founders can manage all promo codes
CREATE POLICY "Founders can manage promo codes"
  ON public.promo_codes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('founder', 'co_founder')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('founder', 'co_founder')
    )
  );

-- Anyone can view active promo codes (for validation)
CREATE POLICY "Anyone can view active promo codes"
  ON public.promo_codes
  FOR SELECT
  USING (is_active = true AND expires_at > now());

-- Create function to validate and use promo code
CREATE OR REPLACE FUNCTION public.validate_promo_code(promo_code TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  discount_percentage INTEGER,
  message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code public.promo_codes%ROWTYPE;
BEGIN
  -- Get the promo code
  SELECT * INTO v_code
  FROM public.promo_codes
  WHERE code = UPPER(promo_code)
  LIMIT 1;

  -- Check if code exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'Code promo invalide'::TEXT;
    RETURN;
  END IF;

  -- Check if code is active
  IF v_code.is_active = false THEN
    RETURN QUERY SELECT false, 0, 'Ce code promo n''est plus actif'::TEXT;
    RETURN;
  END IF;

  -- Check if code has expired
  IF v_code.expires_at < now() THEN
    RETURN QUERY SELECT false, 0, 'Ce code promo a expiré'::TEXT;
    RETURN;
  END IF;

  -- Check if code has reached max uses
  IF v_code.current_uses >= v_code.max_uses THEN
    RETURN QUERY SELECT false, 0, 'Ce code promo a atteint sa limite d''utilisation'::TEXT;
    RETURN;
  END IF;

  -- Code is valid
  RETURN QUERY SELECT true, v_code.discount_percentage, 'Code promo valide'::TEXT;
END;
$$;

-- Create function to increment promo code usage
CREATE OR REPLACE FUNCTION public.increment_promo_usage(promo_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.promo_codes
  SET 
    current_uses = current_uses + 1,
    updated_at = now()
  WHERE code = UPPER(promo_code)
    AND is_active = true
    AND expires_at > now()
    AND current_uses < max_uses;

  RETURN FOUND;
END;
$$;

-- Create trigger to update updated_at
CREATE TRIGGER update_promo_codes_updated_at
  BEFORE UPDATE ON public.promo_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();