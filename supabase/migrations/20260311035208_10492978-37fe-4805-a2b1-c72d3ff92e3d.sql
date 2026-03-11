
-- ═══════════════════════════════════════════════════════════════════
-- SIMPLIFICAÇÃO DO BANCO: Merge 2 tabelas duplicadas
-- ═══════════════════════════════════════════════════════════════════
-- ANTES: 16 tabelas → DEPOIS: 14 tabelas
-- 1. participantes_documento → absorvido por signatarios
-- 2. trilha_auditoria_documentos → absorvido por trilha_auditoria
-- ═══════════════════════════════════════════════════════════════════

-- ── MERGE 1: signatarios absorve participantes_documento ──
ALTER TABLE signatarios 
  ADD COLUMN IF NOT EXISTS tipo_autenticacao text NOT NULL DEFAULT 'EXTERNA_KYC',
  ADD COLUMN IF NOT EXISTS papel text NOT NULL DEFAULT 'ASSINANTE';

-- ── MERGE 2: trilha_auditoria absorve trilha_auditoria_documentos ──
ALTER TABLE trilha_auditoria 
  ADD COLUMN IF NOT EXISTS agente_usuario text,
  ADD COLUMN IF NOT EXISTS latitude text,
  ADD COLUMN IF NOT EXISTS longitude text,
  ADD COLUMN IF NOT EXISTS caminho_foto_selfie text,
  ADD COLUMN IF NOT EXISTS caminho_foto_documento_oficial text,
  ADD COLUMN IF NOT EXISTS endereco_formatado text,
  ADD COLUMN IF NOT EXISTS hash_documento text,
  ADD COLUMN IF NOT EXISTS metadados jsonb DEFAULT '{}'::jsonb;

-- ── Migrar dados existentes de trilha_auditoria_documentos ──
INSERT INTO trilha_auditoria (
  documento_id, acao, ator, endereco_ip, 
  agente_usuario, latitude, longitude,
  caminho_foto_selfie, caminho_foto_documento_oficial,
  endereco_formatado, hash_documento, metadados, criado_em
)
SELECT 
  documento_id, tipo_evento, 'Sistema', endereco_ip,
  agente_usuario, latitude, longitude,
  caminho_foto_selfie, caminho_foto_documento_oficial,
  endereco_formatado, hash_documento, metadados, criado_em
FROM trilha_auditoria_documentos;

-- ── Migrar dados existentes de participantes_documento para signatarios ──
-- Insere apenas participantes que NÃO existem como signatarios (por email+documento)
INSERT INTO signatarios (
  documento_id, nome, email, funcao, ordem_assinatura, 
  status, tipo_autenticacao, papel, assinado_em
)
SELECT 
  pd.documento_id, pd.nome, pd.email, 
  CASE WHEN pd.papel = 'ASSINANTE' THEN 'signer' ELSE 'observer' END,
  pd.ordem_assinatura,
  CASE 
    WHEN pd.status = 'ASSINADO' THEN 'signed'
    WHEN pd.status = 'PENDENTE' THEN 'pending'
    ELSE 'pending'
  END,
  pd.tipo_autenticacao,
  pd.papel,
  pd.data_assinatura
FROM participantes_documento pd
WHERE NOT EXISTS (
  SELECT 1 FROM signatarios s 
  WHERE s.documento_id = pd.documento_id AND s.email = pd.email
);

-- ── Remover tabelas absorvidas ──
DROP TABLE IF EXISTS trilha_auditoria_documentos CASCADE;
DROP TABLE IF EXISTS participantes_documento CASCADE;
