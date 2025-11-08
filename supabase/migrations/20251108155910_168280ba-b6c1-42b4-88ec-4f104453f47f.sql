-- Change default status for feedback to 'published' for automatic publication
ALTER TABLE public.feedback 
  ALTER COLUMN status SET DEFAULT 'published';