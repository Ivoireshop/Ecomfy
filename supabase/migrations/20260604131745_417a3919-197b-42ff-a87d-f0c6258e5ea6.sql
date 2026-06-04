
CREATE TABLE public.academy_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  video_url text NOT NULL,
  thumbnail_url text,
  duration text,
  level text,
  order_index integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.academy_courses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_courses TO authenticated;
GRANT ALL ON public.academy_courses TO service_role;

ALTER TABLE public.academy_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published academy courses"
  ON public.academy_courses FOR SELECT
  USING (
    is_published = true
    OR public.has_role(auth.uid(), 'founder')
    OR public.has_role(auth.uid(), 'co_founder')
  );

CREATE POLICY "Founders can insert academy courses"
  ON public.academy_courses FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'founder')
    OR public.has_role(auth.uid(), 'co_founder')
  );

CREATE POLICY "Founders can update academy courses"
  ON public.academy_courses FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'founder')
    OR public.has_role(auth.uid(), 'co_founder')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'founder')
    OR public.has_role(auth.uid(), 'co_founder')
  );

CREATE POLICY "Founders can delete academy courses"
  ON public.academy_courses FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'founder')
    OR public.has_role(auth.uid(), 'co_founder')
  );

CREATE TRIGGER update_academy_courses_updated_at
  BEFORE UPDATE ON public.academy_courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_academy_courses_order ON public.academy_courses (order_index, created_at);
CREATE INDEX idx_academy_courses_published ON public.academy_courses (is_published);
