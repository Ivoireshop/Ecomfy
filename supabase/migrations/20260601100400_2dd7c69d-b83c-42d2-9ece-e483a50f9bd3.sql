CREATE TABLE public.app_remediation_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  success boolean NOT NULL DEFAULT false,
  result jsonb,
  error text,
  duration_ms integer,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_remediation_audit_created_at ON public.app_remediation_audit (created_at DESC);
CREATE INDEX idx_app_remediation_audit_action ON public.app_remediation_audit (action);
CREATE INDEX idx_app_remediation_audit_actor ON public.app_remediation_audit (actor_id);

GRANT SELECT ON public.app_remediation_audit TO authenticated;
GRANT ALL ON public.app_remediation_audit TO service_role;

ALTER TABLE public.app_remediation_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders can view audit log"
ON public.app_remediation_audit
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'founder'::app_role)
  OR public.has_role(auth.uid(), 'co_founder'::app_role)
);