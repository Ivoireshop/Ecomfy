-- Table pour les modules de cours
CREATE TABLE IF NOT EXISTS public.course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  module_order INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour les contenus des modules (vidéos, PDFs, textes)
CREATE TABLE IF NOT EXISTS public.module_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL, -- 'video', 'pdf', 'text', 'quiz'
  content_url TEXT, -- URL YouTube/Vimeo pour vidéo, URL du PDF
  content_text TEXT, -- Pour contenu texte
  content_order INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER,
  is_mandatory BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour les accès étudiants (lié aux enrollments validés)
CREATE TABLE IF NOT EXISTS public.student_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  access_granted_at TIMESTAMPTZ DEFAULT NOW(),
  access_expires_at TIMESTAMPTZ, -- NULL = accès illimité
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- Table pour le suivi de progression
CREATE TABLE IF NOT EXISTS public.student_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  content_id UUID REFERENCES public.module_contents(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT false,
  completion_percentage INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  time_spent_minutes INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_id)
);

-- RLS Policies pour course_modules
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site owners can manage modules"
  ON public.course_modules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.showcase_sites s ON s.id = c.showcase_site_id
      WHERE c.id = course_modules.course_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Students can view published modules"
  ON public.course_modules FOR SELECT
  USING (
    is_published = true AND
    EXISTS (
      SELECT 1 FROM public.student_access sa
      WHERE sa.course_id = course_modules.course_id
      AND sa.user_id = auth.uid()
      AND sa.is_active = true
      AND (sa.access_expires_at IS NULL OR sa.access_expires_at > NOW())
    )
  );

-- RLS Policies pour module_contents
ALTER TABLE public.module_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site owners can manage contents"
  ON public.module_contents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.course_modules m
      JOIN public.courses c ON c.id = m.course_id
      JOIN public.showcase_sites s ON s.id = c.showcase_site_id
      WHERE m.id = module_contents.module_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Students can view published contents"
  ON public.module_contents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.course_modules m
      JOIN public.student_access sa ON sa.course_id = m.course_id
      WHERE m.id = module_contents.module_id
      AND sa.user_id = auth.uid()
      AND sa.is_active = true
      AND m.is_published = true
      AND (sa.access_expires_at IS NULL OR sa.access_expires_at > NOW())
    )
  );

-- RLS Policies pour student_access
ALTER TABLE public.student_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site owners can manage student access"
  ON public.student_access FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.showcase_sites s ON s.id = c.showcase_site_id
      WHERE c.id = student_access.course_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Students can view their own access"
  ON public.student_access FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policies pour student_progress
ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can manage their own progress"
  ON public.student_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Site owners can view student progress"
  ON public.student_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.showcase_sites s ON s.id = c.showcase_site_id
      WHERE c.id = student_progress.course_id
      AND s.user_id = auth.uid()
    )
  );

-- Triggers pour updated_at
CREATE TRIGGER update_course_modules_updated_at
  BEFORE UPDATE ON public.course_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_course_updated_at();

CREATE TRIGGER update_module_contents_updated_at
  BEFORE UPDATE ON public.module_contents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_course_updated_at();

CREATE TRIGGER update_student_progress_updated_at
  BEFORE UPDATE ON public.student_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_course_updated_at();

-- Fonction pour créer automatiquement l'accès étudiant quand un paiement est validé
CREATE OR REPLACE FUNCTION public.grant_student_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si le paiement vient d'être validé (passage de pending à paid)
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid') THEN
    -- Créer ou activer l'accès étudiant
    INSERT INTO public.student_access (enrollment_id, user_id, course_id, is_active)
    VALUES (NEW.id, 
            (SELECT id FROM auth.users WHERE email = NEW.student_email LIMIT 1),
            NEW.course_id,
            true)
    ON CONFLICT (user_id, course_id) 
    DO UPDATE SET is_active = true, access_granted_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger pour accorder l'accès automatiquement
CREATE TRIGGER grant_access_on_payment_validation
  AFTER UPDATE ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_student_access();