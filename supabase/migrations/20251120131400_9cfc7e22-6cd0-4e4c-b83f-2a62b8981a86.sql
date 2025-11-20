-- Fix security warning: Set search_path on the trigger function
DROP FUNCTION IF EXISTS public.update_course_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION public.update_course_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Recreate triggers
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