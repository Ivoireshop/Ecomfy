CREATE TABLE public.shop_ai_assistants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL UNIQUE REFERENCES public.shops(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  name text NOT NULL DEFAULT 'Ramina',
  personality text NOT NULL DEFAULT 'friendly',
  source_mode text NOT NULL DEFAULT 'auto_products',
  manual_context text DEFAULT '',
  greeting_languages text[] NOT NULL DEFAULT ARRAY['fr','en','dioula','baoule'],
  conversation_language text NOT NULL DEFAULT 'auto',
  voice_id text NOT NULL DEFAULT 'EXAVITQu4vr4xnSDxMaL',
  auto_open boolean NOT NULL DEFAULT true,
  custom_greeting text DEFAULT '',
  welcome_bubble text DEFAULT '',
  voice_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_ai_assistants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and collaborators can view shop assistant"
  ON public.shop_ai_assistants FOR SELECT
  USING (
    public.is_shop_owner(shop_id, auth.uid())
    OR public.is_shop_collaborator(shop_id, auth.uid())
  );

CREATE POLICY "Public can view enabled assistant for visible shops"
  ON public.shop_ai_assistants FOR SELECT
  USING (
    enabled = true
    AND public.is_shop_publicly_visible(shop_id)
  );

CREATE POLICY "Owners can insert shop assistant"
  ON public.shop_ai_assistants FOR INSERT
  WITH CHECK (public.is_shop_owner(shop_id, auth.uid()));

CREATE POLICY "Owners and collaborators can update shop assistant"
  ON public.shop_ai_assistants FOR UPDATE
  USING (
    public.is_shop_owner(shop_id, auth.uid())
    OR public.is_shop_collaborator(shop_id, auth.uid())
  );

CREATE POLICY "Owners can delete shop assistant"
  ON public.shop_ai_assistants FOR DELETE
  USING (public.is_shop_owner(shop_id, auth.uid()));

CREATE TRIGGER trg_shop_ai_assistants_updated_at
  BEFORE UPDATE ON public.shop_ai_assistants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();