
-- Helper function: check if a document has signers with tokens (bypasses RLS)
CREATE OR REPLACE FUNCTION public.document_has_signer_token(p_document_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.signers
    WHERE document_id = p_document_id AND sign_token IS NOT NULL
  );
$$;

-- Helper function: check if document belongs to user (bypasses RLS)
CREATE OR REPLACE FUNCTION public.document_belongs_to_user(p_document_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.documents
    WHERE id = p_document_id AND user_id = p_user_id
  );
$$;

-- Helper function: check if signer has token (bypasses RLS)
CREATE OR REPLACE FUNCTION public.signer_has_token(p_signer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.signers
    WHERE id = p_signer_id AND sign_token IS NOT NULL
  );
$$;

-- Fix documents SELECT policies
DROP POLICY IF EXISTS "Public can view documents via signer token" ON public.documents;
CREATE POLICY "Public can view documents via signer token" ON public.documents
  FOR SELECT TO anon, authenticated
  USING (public.document_has_signer_token(id));

-- Fix signers SELECT/UPDATE/DELETE/INSERT policies that reference documents
DROP POLICY IF EXISTS "Document owners can view signers" ON public.signers;
CREATE POLICY "Document owners can view signers" ON public.signers
  FOR SELECT TO authenticated
  USING (public.document_belongs_to_user(document_id, auth.uid()));

DROP POLICY IF EXISTS "Document owners can create signers" ON public.signers;
CREATE POLICY "Document owners can create signers" ON public.signers
  FOR INSERT TO public
  WITH CHECK (public.document_belongs_to_user(document_id, auth.uid()));

DROP POLICY IF EXISTS "Document owners can delete signers" ON public.signers;
CREATE POLICY "Document owners can delete signers" ON public.signers
  FOR DELETE TO public
  USING (public.document_belongs_to_user(document_id, auth.uid()));

DROP POLICY IF EXISTS "Document owners can update signers" ON public.signers;
CREATE POLICY "Document owners can update signers" ON public.signers
  FOR UPDATE TO authenticated
  USING (public.document_belongs_to_user(document_id, auth.uid()));

-- Fix document_fields policies
DROP POLICY IF EXISTS "Document owners can manage fields" ON public.document_fields;
CREATE POLICY "Document owners can manage fields" ON public.document_fields
  FOR ALL TO authenticated
  USING (public.document_belongs_to_user(document_id, auth.uid()));

DROP POLICY IF EXISTS "Public can view fields by signer token" ON public.document_fields;
CREATE POLICY "Public can view fields by signer token" ON public.document_fields
  FOR SELECT TO anon, authenticated
  USING (public.signer_has_token(signer_id));

DROP POLICY IF EXISTS "Signers can update fields by token" ON public.document_fields;
CREATE POLICY "Signers can update fields by token" ON public.document_fields
  FOR UPDATE TO anon, authenticated
  USING (public.signer_has_token(signer_id));

-- Fix audit_trail policies
DROP POLICY IF EXISTS "Document owners can view audit trail" ON public.audit_trail;
CREATE POLICY "Document owners can view audit trail" ON public.audit_trail
  FOR SELECT TO authenticated
  USING (public.document_belongs_to_user(document_id, auth.uid()));

DROP POLICY IF EXISTS "Public can view audit trail by signer token" ON public.audit_trail;
CREATE POLICY "Public can view audit trail by signer token" ON public.audit_trail
  FOR SELECT TO anon, authenticated
  USING (public.document_has_signer_token(document_id));

-- Fix signatures policy
DROP POLICY IF EXISTS "Document owners can view signatures" ON public.signatures;
CREATE POLICY "Document owners can view signatures" ON public.signatures
  FOR SELECT TO public
  USING (public.document_belongs_to_user(document_id, auth.uid()));
