-- Table pour les formations et services
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  showcase_site_id UUID NOT NULL REFERENCES public.showcase_sites(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  short_description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XOF',
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'formation', -- 'formation' ou 'service'
  duration TEXT, -- "3 mois", "1 jour", etc.
  level TEXT, -- "Débutant", "Intermédiaire", "Avancé"
  is_published BOOLEAN DEFAULT false,
  max_participants INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour les liens de paiement configurables
CREATE TABLE IF NOT EXISTS public.payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'mtn', 'orange', 'wave', 'stripe', 'paypal', 'visa', etc.
  payment_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour les inscriptions/achats
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  showcase_site_id UUID NOT NULL REFERENCES public.showcase_sites(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_email TEXT NOT NULL,
  student_phone TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'cancelled'
  payment_method TEXT, -- 'mtn', 'orange', 'wave', etc.
  payment_proof_url TEXT, -- URL du justificatif de paiement uploadé
  amount_paid DECIMAL(10,2),
  transaction_reference TEXT,
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour les demandes d'information/réservation
CREATE TABLE IF NOT EXISTS public.course_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  showcase_site_id UUID NOT NULL REFERENCES public.showcase_sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new', -- 'new', 'contacted', 'converted', 'cancelled'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies pour courses
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published courses"
  ON public.courses FOR SELECT
  USING (is_published = true);

CREATE POLICY "Site owners can manage their courses"
  ON public.courses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.showcase_sites
      WHERE showcase_sites.id = courses.showcase_site_id
      AND showcase_sites.user_id = auth.uid()
    )
  );

-- RLS Policies pour payment_links
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active payment links"
  ON public.payment_links FOR SELECT
  USING (is_active = true);

CREATE POLICY "Site owners can manage payment links"
  ON public.payment_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.showcase_sites s ON s.id = c.showcase_site_id
      WHERE c.id = payment_links.course_id
      AND s.user_id = auth.uid()
    )
  );

-- RLS Policies pour enrollments
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create enrollments"
  ON public.enrollments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Site owners can view and manage enrollments"
  ON public.enrollments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.showcase_sites
      WHERE showcase_sites.id = enrollments.showcase_site_id
      AND showcase_sites.user_id = auth.uid()
    )
  );

-- RLS Policies pour course_inquiries
ALTER TABLE public.course_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create inquiries"
  ON public.course_inquiries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Site owners can view and manage inquiries"
  ON public.course_inquiries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.showcase_sites
      WHERE showcase_sites.id = course_inquiries.showcase_site_id
      AND showcase_sites.user_id = auth.uid()
    )
  );

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION public.update_course_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_course_updated_at();

CREATE TRIGGER update_payment_links_updated_at
  BEFORE UPDATE ON public.payment_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_course_updated_at();

CREATE TRIGGER update_enrollments_updated_at
  BEFORE UPDATE ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_course_updated_at();

CREATE TRIGGER update_course_inquiries_updated_at
  BEFORE UPDATE ON public.course_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_course_updated_at();