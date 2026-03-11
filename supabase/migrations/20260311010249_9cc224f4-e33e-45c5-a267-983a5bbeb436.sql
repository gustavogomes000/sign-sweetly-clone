
-- ============================================================
-- 1. Tabela: participantes_documento (gerencia workflow)
-- ============================================================
CREATE TABLE public.participantes_documento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id UUID NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'ASSINANTE' CHECK (papel IN ('ASSINANTE', 'OBSERVADOR')),
  ordem_assinatura INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'NOTIFICADO', 'ASSINADO')),
  tipo_autenticacao TEXT NOT NULL DEFAULT 'EXTERNA_KYC' CHECK (tipo_autenticacao IN ('EXTERNA_KYC', 'INTERNA_BLUEPOINT')),
  data_assinatura TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger de atualização
CREATE TRIGGER trg_participantes_updated_at
  BEFORE UPDATE ON public.participantes_documento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.participantes_documento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Donos gerenciam participantes"
  ON public.participantes_documento FOR ALL
  TO authenticated
  USING (document_belongs_to_user(documento_id, auth.uid()))
  WITH CHECK (document_belongs_to_user(documento_id, auth.uid()));

CREATE POLICY "Publico ve participantes por token"
  ON public.participantes_documento FOR SELECT
  TO anon, authenticated
  USING (document_has_signer_token(documento_id));

-- ============================================================
-- 2. Tabela: trilha_auditoria_documentos (cofre de evidências)
-- ============================================================
CREATE TABLE public.trilha_auditoria_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id UUID NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  participante_id UUID REFERENCES public.participantes_documento(id),
  tipo_evento TEXT NOT NULL,
  endereco_ip TEXT,
  agente_usuario TEXT,
  latitude TEXT,
  longitude TEXT,
  endereco_formatado TEXT,
  hash_documento TEXT,
  caminho_foto_selfie TEXT,
  caminho_foto_documento_oficial TEXT,
  metadados JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: apenas INSERT e SELECT (nunca UPDATE/DELETE)
ALTER TABLE public.trilha_auditoria_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer um insere evidencia"
  ON public.trilha_auditoria_documentos FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Donos veem evidencias"
  ON public.trilha_auditoria_documentos FOR SELECT
  TO authenticated
  USING (document_belongs_to_user(documento_id, auth.uid()));

CREATE POLICY "Publico ve evidencias por token"
  ON public.trilha_auditoria_documentos FOR SELECT
  TO anon, authenticated
  USING (document_has_signer_token(documento_id));

-- ============================================================
-- 3. Bucket privado para evidências KYC
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidencias_kyc', 'evidencias_kyc', false)
ON CONFLICT (id) DO NOTHING;

-- RLS para o bucket: autenticados podem upload, donos podem ler
CREATE POLICY "Upload evidencias autenticado e anonimo"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'evidencias_kyc');

CREATE POLICY "Donos leem evidencias"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'evidencias_kyc');
