-- Create table for showcase websites
CREATE TABLE public.showcase_sites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subdomain TEXT NOT NULL UNIQUE,
  custom_domain TEXT,
  business_name TEXT NOT NULL,
  business_description TEXT,
  owner_name TEXT NOT NULL,
  owner_photo_url TEXT,
  whatsapp_number TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  formation_title TEXT,
  formation_description TEXT,
  formation_price TEXT,
  formation_image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.showcase_sites ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can create their own showcase sites"
ON public.showcase_sites
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own showcase sites"
ON public.showcase_sites
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own showcase sites"
ON public.showcase_sites
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own showcase sites"
ON public.showcase_sites
FOR DELETE
USING (auth.uid() = user_id);

-- Allow anyone to view published sites by subdomain
CREATE POLICY "Anyone can view published showcase sites"
ON public.showcase_sites
FOR SELECT
USING (is_published = true);

-- Add trigger for updated_at
CREATE TRIGGER update_showcase_sites_updated_at
BEFORE UPDATE ON public.showcase_sites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();