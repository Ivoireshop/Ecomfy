-- Add RLS policy to allow public certificate verification by certificate number
CREATE POLICY "Anyone can verify certificates by number"
ON public.course_certificates
FOR SELECT
USING (true);