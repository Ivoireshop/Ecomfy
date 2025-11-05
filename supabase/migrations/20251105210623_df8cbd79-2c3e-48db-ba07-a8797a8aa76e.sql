-- Create contact_submissions table to store form submissions
CREATE TABLE public.contact_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  showcase_site_id UUID NOT NULL REFERENCES public.showcase_sites(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'new',
  read_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone can submit contact forms
CREATE POLICY "Anyone can submit contact forms"
ON public.contact_submissions
FOR INSERT
WITH CHECK (true);

-- Site owners can view submissions for their sites
CREATE POLICY "Users can view submissions for their sites"
ON public.contact_submissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.showcase_sites
    WHERE showcase_sites.id = contact_submissions.showcase_site_id
    AND showcase_sites.user_id = auth.uid()
  )
);

-- Site owners can update submission status
CREATE POLICY "Users can update their site submissions"
ON public.contact_submissions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.showcase_sites
    WHERE showcase_sites.id = contact_submissions.showcase_site_id
    AND showcase_sites.user_id = auth.uid()
  )
);

-- Create index for better performance
CREATE INDEX idx_contact_submissions_showcase_site ON public.contact_submissions(showcase_site_id);
CREATE INDEX idx_contact_submissions_created_at ON public.contact_submissions(created_at DESC);