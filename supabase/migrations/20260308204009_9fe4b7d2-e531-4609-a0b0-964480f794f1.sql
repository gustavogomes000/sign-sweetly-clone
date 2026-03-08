
-- API Keys table for external system authentication
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['documents:read', 'documents:write'],
  active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  UNIQUE(key_hash)
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own API keys"
  ON public.api_keys FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Webhooks table for callback notifications
CREATE TABLE public.webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY['document.signed', 'document.completed'],
  secret text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_triggered_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own webhooks"
  ON public.webhooks FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Webhook delivery log
CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  status_code integer,
  response_body text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their webhook deliveries"
  ON public.webhook_deliveries FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.webhooks w WHERE w.id = webhook_deliveries.webhook_id AND w.user_id = auth.uid()
  ));

-- Function to validate API key and return user_id (used by edge functions)
CREATE OR REPLACE FUNCTION public.validate_api_key(p_key_hash text)
RETURNS TABLE(user_id uuid, scopes text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ak.user_id, ak.scopes
  FROM public.api_keys ak
  WHERE ak.key_hash = p_key_hash
    AND ak.active = true
    AND (ak.expires_at IS NULL OR ak.expires_at > now());
$$;
