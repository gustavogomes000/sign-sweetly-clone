
ALTER TABLE public.documentos 
ADD COLUMN IF NOT EXISTS caminho_pdf_final TEXT,
ADD COLUMN IF NOT EXISTS caminho_pdf_dossie TEXT;
