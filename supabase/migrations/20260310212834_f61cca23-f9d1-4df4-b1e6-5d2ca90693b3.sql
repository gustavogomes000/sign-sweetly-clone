
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS default_validations text[] NOT NULL DEFAULT '{}';
