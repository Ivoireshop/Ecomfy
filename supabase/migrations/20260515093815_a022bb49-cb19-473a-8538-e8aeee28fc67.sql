
CREATE POLICY "Founders can view all shops"
ON public.shops FOR SELECT
USING (has_role(auth.uid(), 'founder'::app_role) OR has_role(auth.uid(), 'co_founder'::app_role));

CREATE POLICY "Founders can view all courses"
ON public.courses FOR SELECT
USING (has_role(auth.uid(), 'founder'::app_role) OR has_role(auth.uid(), 'co_founder'::app_role));

CREATE POLICY "Founders can view all showcase sites"
ON public.showcase_sites FOR SELECT
USING (has_role(auth.uid(), 'founder'::app_role) OR has_role(auth.uid(), 'co_founder'::app_role));
