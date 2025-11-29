-- Add domain management fields to showcase_sites
ALTER TABLE public.showcase_sites
ADD COLUMN IF NOT EXISTS domain_verification_code TEXT,
ADD COLUMN IF NOT EXISTS domain_status TEXT DEFAULT 'not_configured',
ADD COLUMN IF NOT EXISTS domain_last_check TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ssl_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS dns_propagation_percentage INTEGER DEFAULT 0;

-- Create function to generate unique verification code
CREATE OR REPLACE FUNCTION generate_domain_verification_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  verification_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    verification_code := 'visualpro-' || LOWER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 16));
    
    SELECT EXISTS(
      SELECT 1 FROM showcase_sites 
      WHERE domain_verification_code = verification_code
    ) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN verification_code;
END;
$$;

-- Create trigger to generate verification code when custom_domain is set
CREATE OR REPLACE FUNCTION set_domain_verification_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.custom_domain IS NOT NULL AND NEW.custom_domain != '' AND 
     (OLD.custom_domain IS NULL OR OLD.custom_domain = '' OR OLD.custom_domain != NEW.custom_domain) THEN
    NEW.domain_verification_code := generate_domain_verification_code();
    NEW.domain_status := 'pending_verification';
    NEW.dns_propagation_percentage := 0;
    NEW.ssl_status := 'pending';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_domain_verification_code
BEFORE UPDATE ON public.showcase_sites
FOR EACH ROW
EXECUTE FUNCTION set_domain_verification_code();