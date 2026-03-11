/**
 * Serviço de processamento de assinatura — integra o front-end
 * com a edge function processar-assinatura.
 */
import { supabase } from '@/integrations/supabase/client';
import type { EvidenciasColetadas } from '@/components/assinatura/StepperAssinatura';

/**
 * Envia todas as evidências coletadas no wizard para a edge function.
 */
export async function processarEvidencias(dados: {
  documentoId: string;
  participanteId: string;
  tipoEvento: string;
  evidencias: EvidenciasColetadas;
  hashDocumento?: string;
}) {
  const { data, error } = await supabase.functions.invoke('processar-assinatura', {
    body: {
      documentoId: dados.documentoId,
      participanteId: dados.participanteId,
      tipoEvento: dados.tipoEvento,
      selfieBase64: dados.evidencias.selfieBase64 || null,
      documentoBase64: dados.evidencias.documentoBase64 || null,
      tipoDocumento: dados.evidencias.tipoDocumento || null,
      latitude: dados.evidencias.geolocalizacao?.latitude || null,
      longitude: dados.evidencias.geolocalizacao?.longitude || null,
      enderecoFormatado: dados.evidencias.geolocalizacao?.enderecoFormatado || null,
      agenteUsuario: dados.evidencias.agenteUsuario,
      hashDocumento: dados.hashDocumento || null,
      biometriaAprovada: dados.evidencias.biometriaAprovada || null,
    },
  });

  if (error) throw new Error(`Erro ao processar evidências: ${error.message}`);
  return data;
}

/**
 * Cria participantes (signatários) na tabela signatarios.
 * Tabela unificada — substitui a antiga participantes_documento.
 */
export async function criarParticipantes(
  documentoId: string,
  participantes: Array<{
    nome: string;
    email: string;
    papel: 'ASSINANTE' | 'OBSERVADOR';
    ordemAssinatura: number;
    tipoAutenticacao: 'EXTERNA_KYC' | 'INTERNA_BLUEPOINT';
  }>
) {
  const { data, error } = await supabase
    .from('signatarios')
    .insert(
      participantes.map((p) => ({
        documento_id: documentoId,
        nome: p.nome,
        email: p.email,
        papel: p.papel,
        funcao: p.papel === 'ASSINANTE' ? 'signer' : 'observer',
        ordem_assinatura: p.ordemAssinatura,
        tipo_autenticacao: p.tipoAutenticacao,
        status: 'pending',
      }))
    )
    .select();

  if (error) throw error;
  return data;
}

/**
 * Buscar participantes/signatários de um documento.
 */
export async function buscarParticipantes(documentoId: string) {
  const { data, error } = await supabase
    .from('signatarios')
    .select('*')
    .eq('documento_id', documentoId)
    .order('ordem_assinatura', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Buscar trilha de auditoria com evidências de um documento.
 * Tabela unificada — substitui a antiga trilha_auditoria_documentos.
 */
export async function buscarTrilhaAuditoria(documentoId: string) {
  const { data, error } = await supabase
    .from('trilha_auditoria')
    .select('*')
    .eq('documento_id', documentoId)
    .order('criado_em', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Gerar hash SHA-256 de um arquivo (para integração futura com PDF).
 */
export async function gerarHashArquivo(arquivo: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', arquivo);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
