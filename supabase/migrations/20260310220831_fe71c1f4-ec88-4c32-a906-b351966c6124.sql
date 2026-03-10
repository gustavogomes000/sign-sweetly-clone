
-- Fix documents: make SELECT policies PERMISSIVE (OR logic)
DROP POLICY IF EXISTS "Public can view documents via signer token" ON public.documents;
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;

CREATE POLICY "Users can view their own documents" ON public.documents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Public can view documents via signer token" ON public.documents
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.signers WHERE signers.document_id = documents.id AND signers.sign_token IS NOT NULL)
  );

-- Fix signers: make SELECT policies PERMISSIVE
DROP POLICY IF EXISTS "Document owners can view signers" ON public.signers;
DROP POLICY IF EXISTS "Signers can view by token" ON public.signers;

CREATE POLICY "Document owners can view signers" ON public.signers
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.documents WHERE documents.id = signers.document_id AND documents.user_id = auth.uid())
  );

CREATE POLICY "Signers can view by token" ON public.signers
  FOR SELECT TO anon, authenticated USING (sign_token IS NOT NULL);

-- Fix signers UPDATE
DROP POLICY IF EXISTS "Document owners can update signers" ON public.signers;
DROP POLICY IF EXISTS "Signers can update by token" ON public.signers;

CREATE POLICY "Document owners can update signers" ON public.signers
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.documents WHERE documents.id = signers.document_id AND documents.user_id = auth.uid())
  );

CREATE POLICY "Signers can update by token" ON public.signers
  FOR UPDATE TO anon, authenticated USING (sign_token IS NOT NULL);

-- Fix document_fields: make SELECT policies PERMISSIVE
DROP POLICY IF EXISTS "Document owners can manage fields" ON public.document_fields;
DROP POLICY IF EXISTS "Public can view fields by signer token" ON public.document_fields;
DROP POLICY IF EXISTS "Signers can update fields by token" ON public.document_fields;

CREATE POLICY "Document owners can manage fields" ON public.document_fields
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.documents WHERE documents.id = document_fields.document_id AND documents.user_id = auth.uid())
  );

CREATE POLICY "Public can view fields by signer token" ON public.document_fields
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.signers WHERE signers.id = document_fields.signer_id AND signers.sign_token IS NOT NULL)
  );

CREATE POLICY "Signers can update fields by token" ON public.document_fields
  FOR UPDATE TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.signers WHERE signers.id = document_fields.signer_id AND signers.sign_token IS NOT NULL)
  );
