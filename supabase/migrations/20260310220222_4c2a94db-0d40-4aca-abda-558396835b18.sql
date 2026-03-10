-- Drop the restrictive SELECT policies on documents
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
DROP POLICY IF EXISTS "Public can view documents via signer token" ON public.documents;

-- Recreate as PERMISSIVE (default) so either one passing is enough
CREATE POLICY "Users can view their own documents"
ON public.documents
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Public can view documents via signer token"
ON public.documents
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.signers
    WHERE signers.document_id = documents.id
    AND signers.sign_token IS NOT NULL
  )
);

-- Also fix document_fields SELECT policies
DROP POLICY IF EXISTS "Public can view fields by signer token" ON public.document_fields;

CREATE POLICY "Public can view fields by signer token"
ON public.document_fields
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.signers
    WHERE signers.id = document_fields.signer_id
    AND signers.sign_token IS NOT NULL
  )
);

-- Fix document_fields UPDATE for signers
DROP POLICY IF EXISTS "Signers can update fields by token" ON public.document_fields;

CREATE POLICY "Signers can update fields by token"
ON public.document_fields
FOR UPDATE
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.signers
    WHERE signers.id = document_fields.signer_id
    AND signers.sign_token IS NOT NULL
  )
);

-- Fix signers policies to include anon role
DROP POLICY IF EXISTS "Signers can view by token" ON public.signers;
DROP POLICY IF EXISTS "Signers can update by token" ON public.signers;

CREATE POLICY "Signers can view by token"
ON public.signers
FOR SELECT
TO anon, authenticated
USING (sign_token IS NOT NULL);

CREATE POLICY "Signers can update by token"
ON public.signers
FOR UPDATE
TO anon, authenticated
USING (sign_token IS NOT NULL);