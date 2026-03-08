
-- Add origin column to track where documents come from (manual vs API)
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual';

-- Add external_ref column for external system reference IDs
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS external_ref text;

-- Add source_system column for identifying which integration sent the doc
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS source_system text;
