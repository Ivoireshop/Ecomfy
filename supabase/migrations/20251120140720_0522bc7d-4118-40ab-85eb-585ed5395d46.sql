-- Table pour stocker les certificats de formation
CREATE TABLE IF NOT EXISTS public.course_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  course_title TEXT NOT NULL,
  completion_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  certificate_url TEXT NOT NULL,
  certificate_number TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- Index pour rechercher rapidement les certificats d'un étudiant
CREATE INDEX idx_certificates_user_id ON public.course_certificates(user_id);
CREATE INDEX idx_certificates_course_id ON public.course_certificates(course_id);

-- RLS policies
ALTER TABLE public.course_certificates ENABLE ROW LEVEL SECURITY;

-- Les étudiants peuvent voir leurs propres certificats
CREATE POLICY "Students can view their own certificates"
  ON public.course_certificates
  FOR SELECT
  USING (auth.uid() = user_id);

-- Les propriétaires de sites peuvent voir les certificats de leurs formations
CREATE POLICY "Site owners can view certificates for their courses"
  ON public.course_certificates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses c
      JOIN showcase_sites s ON s.id = c.showcase_site_id
      WHERE c.id = course_certificates.course_id
      AND s.user_id = auth.uid()
    )
  );

-- Fonction pour générer un numéro de certificat unique
CREATE OR REPLACE FUNCTION public.generate_certificate_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cert_number TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Format: CERT-YYYYMMDD-XXXXX (X = random alphanumeric)
    cert_number := 'CERT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                   UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 5));
    
    SELECT EXISTS(
      SELECT 1 FROM course_certificates 
      WHERE certificate_number = cert_number
    ) INTO exists_check;
    
    EXIT WHEN NOT exists_check;
  END LOOP;
  
  RETURN cert_number;
END;
$$;