
-- Fix documents SELECT policies: drop restrictive, recreate as permissive
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
DROP POLICY IF EXISTS "Public can view documents via signer token" ON public.documents;

CREATE POLICY "Users can view their own documents" ON public.documents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Public can view documents via signer token" ON public.documents
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.signers s
    WHERE s.document_id = documents.id AND s.sign_token IS NOT NULL
  ));

-- Fix signers SELECT policies
DROP POLICY IF EXISTS "Document owners can view signers" ON public.signers;
DROP POLICY IF EXISTS "Signers can view by token" ON public.signers;

CREATE POLICY "Document owners can view signers" ON public.signers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = signers.document_id AND d.user_id = auth.uid()
  ));

CREATE POLICY "Signers can view by token" ON public.signers
  FOR SELECT TO anon, authenticated
  USING (sign_token IS NOT NULL);

-- Fix document_fields SELECT policies
DROP POLICY IF EXISTS "Document owners can manage fields" ON public.document_fields;
DROP POLICY IF EXISTS "Public can view fields by signer token" ON public.document_fields;

CREATE POLICY "Document owners can manage fields" ON public.document_fields
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_fields.document_id AND d.user_id = auth.uid()
  ));

CREATE POLICY "Public can view fields by signer token" ON public.document_fields
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.signers s
    WHERE s.id = document_fields.signer_id AND s.sign_token IS NOT NULL
  ));

-- Fix audit_trail SELECT policy
DROP POLICY IF EXISTS "Document owners can view audit trail" ON public.audit_trail;

CREATE POLICY "Document owners can view audit trail" ON public.audit_trail
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = audit_trail.document_id AND d.user_id = auth.uid()
  ));

CREATE POLICY "Public can view audit trail by signer token" ON public.audit_trail
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.signers s
    WHERE s.document_id = audit_trail.document_id AND s.sign_token IS NOT NULL
  ));
