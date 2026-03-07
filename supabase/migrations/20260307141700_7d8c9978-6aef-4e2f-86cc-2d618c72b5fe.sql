
-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Documents table
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'signed', 'cancelled', 'expired')),
  file_path TEXT,
  signature_type TEXT NOT NULL DEFAULT 'electronic',
  deadline TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own documents" ON public.documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create documents" ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own documents" ON public.documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own documents" ON public.documents FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Signers table
CREATE TABLE public.signers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'signer',
  sign_order INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'refused')),
  signed_at TIMESTAMP WITH TIME ZONE,
  bluetech_signatory_id TEXT,
  bluetech_document_id TEXT,
  sign_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.signers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Document owners can view signers" ON public.signers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.documents WHERE documents.id = signers.document_id AND documents.user_id = auth.uid()));
CREATE POLICY "Document owners can create signers" ON public.signers FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.documents WHERE documents.id = signers.document_id AND documents.user_id = auth.uid()));
CREATE POLICY "Document owners can update signers" ON public.signers FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.documents WHERE documents.id = signers.document_id AND documents.user_id = auth.uid()));
CREATE POLICY "Document owners can delete signers" ON public.signers FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.documents WHERE documents.id = signers.document_id AND documents.user_id = auth.uid()));
CREATE POLICY "Signers can view by token" ON public.signers FOR SELECT USING (sign_token IS NOT NULL);
CREATE POLICY "Signers can update by token" ON public.signers FOR UPDATE USING (sign_token IS NOT NULL);

CREATE TRIGGER update_signers_updated_at BEFORE UPDATE ON public.signers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Document fields (signature positions)
CREATE TABLE public.document_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  signer_id UUID REFERENCES public.signers(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL DEFAULT 'signature' CHECK (field_type IN ('signature', 'initials', 'date', 'text', 'checkbox')),
  label TEXT,
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  width DOUBLE PRECISION NOT NULL DEFAULT 200,
  height DOUBLE PRECISION NOT NULL DEFAULT 60,
  page INT NOT NULL DEFAULT 1,
  required BOOLEAN NOT NULL DEFAULT true,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.document_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Document owners can manage fields" ON public.document_fields FOR ALL
  USING (EXISTS (SELECT 1 FROM public.documents WHERE documents.id = document_fields.document_id AND documents.user_id = auth.uid()));
CREATE POLICY "Public can view fields by signer token" ON public.document_fields FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.signers WHERE signers.id = document_fields.signer_id AND signers.sign_token IS NOT NULL));

-- Signatures table
CREATE TABLE public.signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signer_id UUID NOT NULL REFERENCES public.signers(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  field_id UUID REFERENCES public.document_fields(id) ON DELETE SET NULL,
  signature_type TEXT NOT NULL CHECK (signature_type IN ('drawn', 'typed')),
  image_base64 TEXT,
  typed_text TEXT,
  ip_address TEXT,
  user_agent TEXT,
  bluetech_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Document owners can view signatures" ON public.signatures FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.documents WHERE documents.id = signatures.document_id AND documents.user_id = auth.uid()));
CREATE POLICY "Public can insert signatures" ON public.signatures FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can view signatures" ON public.signatures FOR SELECT USING (true);

-- Validation steps
CREATE TABLE public.validation_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signer_id UUID NOT NULL REFERENCES public.signers(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  step_type TEXT NOT NULL CHECK (step_type IN ('selfie', 'document_photo', 'selfie_with_document')),
  step_order INT NOT NULL DEFAULT 1,
  required BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  bluetech_response JSONB,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.validation_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Document owners can manage validation steps" ON public.validation_steps FOR ALL
  USING (EXISTS (SELECT 1 FROM public.documents WHERE documents.id = validation_steps.document_id AND documents.user_id = auth.uid()));
CREATE POLICY "Public can view validation steps" ON public.validation_steps FOR SELECT USING (true);
CREATE POLICY "Public can insert validation steps" ON public.validation_steps FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update validation steps" ON public.validation_steps FOR UPDATE USING (true);

-- Audit trail
CREATE TABLE public.audit_trail (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  signer_id UUID REFERENCES public.signers(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Document owners can view audit trail" ON public.audit_trail FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.documents WHERE documents.id = audit_trail.document_id AND documents.user_id = auth.uid()));
CREATE POLICY "Public can insert audit entries" ON public.audit_trail FOR INSERT WITH CHECK (true);

-- Storage bucket for document PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true);

CREATE POLICY "Authenticated users can upload documents" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);
CREATE POLICY "Anyone can view documents" ON storage.objects FOR SELECT
  USING (bucket_id = 'documents');
CREATE POLICY "Users can update their documents" ON storage.objects FOR UPDATE
  USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete their documents" ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);
