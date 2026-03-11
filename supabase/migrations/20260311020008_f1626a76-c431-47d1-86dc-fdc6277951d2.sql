
ALTER TABLE public.documentos
ADD COLUMN IF NOT EXISTS hash_pdf_original TEXT,
ADD COLUMN IF NOT EXISTS hash_pdf_final TEXT;
