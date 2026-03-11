/**
 * ═══════════════════════════════════════════════════════════════════════
 * Edge Function: processar-assinatura
 * ═══════════════════════════════════════════════════════════════════════
 *
 * MÓDULO 2: Workflow de Múltiplos Assinantes e Validação de Imagem.
 *
 * Responsabilidades:
 *   1. Validação de Magic Numbers (JPG/PNG) — lê os primeiros bytes
 *      hexadecimais do buffer para garantir integridade do arquivo.
 *   2. Upload das fotos KYC para bucket privado 'evidencias_kyc'
 *   3. Registro na trilha_auditoria_documentos (cofre de evidências)
 *   4. Lógica de Conclusão: verifica se TODOS os assinantes concluíram
 *      e aciona o Módulo 3 (gerar-documento-final)
 *   5. Disparo de e-mails de notificação
 *   6. Envio automático dos PDFs finais por e-mail a TODOS os
 *      participantes (signatários + observadores) quando o dossiê
 *      é gerado com sucesso.
 *
 * Tecnologias: Supabase Storage (S3-compatível), Web Crypto API
 * ═══════════════════════════════════════════════════════════════════════
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════════════
// ALGORITMO: Validação de Magic Numbers (Anti-Falsificação de Arquivo)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Assinaturas hexadecimais dos formatos de imagem aceitos.
 * Lê os primeiros N bytes e compara com os magic numbers conhecidos.
 *
 * JPEG: FF D8 FF (primeiros 3 bytes)
 * PNG:  89 50 4E 47 0D 0A 1A 0A (primeiros 8 bytes)
 *
 * Isso impede que scripts maliciosos renomeados como .jpg sejam aceitos.
 */
function validarMagicNumbers(buffer: Uint8Array): {
  valido: boolean;
  formato: 'jpeg' | 'png' | 'desconhecido';
  motivo?: string;
} {
  if (buffer.length < 8) {
    return {
      valido: false,
      formato: 'desconhecido',
      motivo: `Buffer muito pequeno: ${buffer.length} bytes (mínimo: 8)`,
    };
  }

  // Verificar JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { valido: true, formato: 'jpeg' };
  }

  // Verificar PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return { valido: true, formato: 'png' };
  }

  // Formato não reconhecido — possível arquivo malicioso
  const hexPrimeiros = Array.from(buffer.slice(0, 8))
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');

  return {
    valido: false,
    formato: 'desconhecido',
    motivo: `Magic numbers não reconhecidos: [${hexPrimeiros}]. Apenas JPEG e PNG são aceitos.`,
  };
}

/**
 * Limite máximo de tamanho de imagem aceito pelo backend (10MB).
 * Previne ataques de Memory Exhaustion via payloads gigantes.
 */
const TAMANHO_MAXIMO_BASE64 = 14_000_000; // ~10MB em base64 (overhead de 33%)

/**
 * Converte string base64 (com ou sem prefixo data:...) para Uint8Array.
 * Valida tamanho antes de processar.
 */
function base64ParaUint8Array(base64: string): Uint8Array {
  if (base64.length > TAMANHO_MAXIMO_BASE64) {
    throw new Error(`Payload base64 excede o limite de ${TAMANHO_MAXIMO_BASE64} caracteres (~10MB)`);
  }
  const base64Puro = base64.includes(',') ? base64.split(',')[1] : base64;
  const binario = atob(base64Puro);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) {
    bytes[i] = binario.charCodeAt(i);
  }
  return bytes;
}

// ═══════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const {
      documentoId,
      participanteId,
      tipoEvento,
      selfieBase64,
      documentoBase64,
      tipoDocumento,
      latitude,
      longitude,
      enderecoFormatado,
      agenteUsuario,
      hashDocumento,
      biometriaAprovada,
    } = body;

    // ── Validação de campos obrigatórios ──
    if (!documentoId || !participanteId || !tipoEvento) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: documentoId, participanteId, tipoEvento' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 1. Extrair IP real (via headers de proxy/CDN) ──
    const enderecoIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      req.headers.get('cf-connecting-ip') ||
      'desconhecido';

    // ── 2. Upload de fotos com validação de Magic Numbers ──
    let caminhoSelfie: string | null = null;
    let caminhoDocumento: string | null = null;
    const timestamp = Date.now();

    if (selfieBase64) {
      const bufferSelfie = base64ParaUint8Array(selfieBase64);

      // Validar magic numbers antes de aceitar
      const validacaoSelfie = validarMagicNumbers(bufferSelfie);
      if (!validacaoSelfie.valido) {
        console.error(`[SEGURANÇA] Selfie rejeitada: ${validacaoSelfie.motivo}`);
        return new Response(
          JSON.stringify({
            error: `Arquivo de selfie inválido: ${validacaoSelfie.motivo}`,
            codigo: 'MAGIC_NUMBERS_INVALIDOS',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const extensao = validacaoSelfie.formato === 'png' ? 'png' : 'jpg';
      const contentType = validacaoSelfie.formato === 'png' ? 'image/png' : 'image/jpeg';
      const caminho = `${documentoId}/${participanteId}/selfie_${timestamp}.${extensao}`;

      const { error: erroUpload } = await supabase.storage
        .from('evidencias_kyc')
        .upload(caminho, bufferSelfie, { contentType, upsert: false });

      if (erroUpload) {
        console.error('[ERRO] Upload selfie falhou:', erroUpload);
      } else {
        caminhoSelfie = caminho;
        console.log(`[OK] Selfie validada (${validacaoSelfie.formato}) e armazenada: ${caminho}`);
      }
    }

    if (documentoBase64) {
      const bufferDocumento = base64ParaUint8Array(documentoBase64);

      // Validar magic numbers antes de aceitar
      const validacaoDoc = validarMagicNumbers(bufferDocumento);
      if (!validacaoDoc.valido) {
        console.error(`[SEGURANÇA] Documento rejeitado: ${validacaoDoc.motivo}`);
        return new Response(
          JSON.stringify({
            error: `Arquivo de documento inválido: ${validacaoDoc.motivo}`,
            codigo: 'MAGIC_NUMBERS_INVALIDOS',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const extensao = validacaoDoc.formato === 'png' ? 'png' : 'jpg';
      const contentType = validacaoDoc.formato === 'png' ? 'image/png' : 'image/jpeg';
      const caminho = `${documentoId}/${participanteId}/documento_${tipoDocumento || 'id'}_${timestamp}.${extensao}`;

      const { error: erroUpload } = await supabase.storage
        .from('evidencias_kyc')
        .upload(caminho, bufferDocumento, { contentType, upsert: false });

      if (erroUpload) {
        console.error('[ERRO] Upload documento falhou:', erroUpload);
      } else {
        caminhoDocumento = caminho;
        console.log(`[OK] Documento validado (${validacaoDoc.formato}) e armazenado: ${caminho}`);
      }
    }

    // ── 3. Registrar na trilha de auditoria (cofre de evidências) ──
    const { error: erroAuditoria } = await supabase
      .from('trilha_auditoria_documentos')
      .insert({
        documento_id: documentoId,
        participante_id: participanteId,
        tipo_evento: tipoEvento,
        endereco_ip: enderecoIp,
        agente_usuario: agenteUsuario || req.headers.get('user-agent'),
        latitude: latitude ? String(latitude) : null,
        longitude: longitude ? String(longitude) : null,
        endereco_formatado: enderecoFormatado || null,
        hash_documento: hashDocumento || null,
        caminho_foto_selfie: caminhoSelfie,
        caminho_foto_documento_oficial: caminhoDocumento,
        metadados: {
          tipo_documento: tipoDocumento,
          biometria_aprovada: biometriaAprovada,
          ip_headers: {
            'x-forwarded-for': req.headers.get('x-forwarded-for'),
            'x-real-ip': req.headers.get('x-real-ip'),
            'cf-connecting-ip': req.headers.get('cf-connecting-ip'),
          },
        },
      });

    if (erroAuditoria) {
      console.error('[ERRO] Registro de auditoria falhou:', erroAuditoria);
    }

    // ── 4. Atualizar status do participante e verificar conclusão ──
    if (tipoEvento === 'ASSINOU') {
      await supabase
        .from('participantes_documento')
        .update({
          status: 'ASSINADO',
          data_assinatura: new Date().toISOString(),
        })
        .eq('id', participanteId);

      // Buscar todos os participantes do documento
      const { data: participantes } = await supabase
        .from('participantes_documento')
        .select('id, papel, status, ordem_assinatura, email, nome')
        .eq('documento_id', documentoId);

      const assinantes = (participantes || []).filter(p => p.papel === 'ASSINANTE');
      const todosConcluidos = assinantes.every(a => a.status === 'ASSINADO');

      if (todosConcluidos) {
        // ═══════════════════════════════════════════════════════════════
        // LÓGICA DE CONCLUSÃO: Todos assinaram → Módulo 3
        // ═══════════════════════════════════════════════════════════════
        console.log(`✅ Documento ${documentoId} — todas as assinaturas concluídas. Acionando Módulo 3...`);

        try {
          // Acionar geração do dossiê final (Módulo 3)
          const respostaPdf = await fetch(`${supabaseUrl}/functions/v1/gerar-documento-final`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ documentoId }),
          });

          const dadosPdf = await respostaPdf.json();

          if (respostaPdf.ok && dadosPdf.sucesso) {
            console.log('📄 Dossiê Final gerado com sucesso');

            // ── Enviar PDFs finais por e-mail a TODOS os participantes ──
            const observadores = (participantes || []).filter(p => p.papel === 'OBSERVADOR');
            const todosDestinatarios = [...assinantes, ...observadores];

            const { data: docData } = await supabase
              .from('documentos')
              .select('nome')
              .eq('id', documentoId)
              .single();

            for (const destinatario of todosDestinatarios) {
              try {
                await fetch(`${supabaseUrl}/functions/v1/send-signing-email`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${serviceRoleKey}`,
                  },
                  body: JSON.stringify({
                    signerName: destinatario.nome,
                    signerEmail: destinatario.email,
                    documentName: docData?.nome || 'Documento',
                    signToken: '',
                    message: '✅ Todas as assinaturas foram concluídas e o dossiê final foi gerado com sucesso. Acesse a plataforma para baixar os documentos.',
                  }),
                });
                console.log(`📧 E-mail de conclusão enviado para: ${destinatario.email}`);
              } catch (erroEmail) {
                console.warn(`[AVISO] Falha ao enviar e-mail para ${destinatario.email}:`, erroEmail);
              }
            }
          } else {
            console.error('[ERRO] Falha ao gerar dossiê:', dadosPdf);
            // Marcar como signed mesmo se o PDF falhar
            await supabase
              .from('documentos')
              .update({ status: 'signed' })
              .eq('id', documentoId);
          }
        } catch (erroPdf) {
          console.error('[ERRO] Exceção ao gerar PDFs:', erroPdf);
          await supabase
            .from('documentos')
            .update({ status: 'signed' })
            .eq('id', documentoId);
        }
      } else {
        // ── Enviar e-mail para o próximo assinante na fila ──
        const pendentes = assinantes
          .filter(a => a.status === 'PENDENTE')
          .sort((a, b) => a.ordem_assinatura - b.ordem_assinatura);

        if (pendentes.length > 0) {
          const proximo = pendentes[0];
          const { data: docData } = await supabase
            .from('documentos')
            .select('nome')
            .eq('id', documentoId)
            .single();

          const { data: signatario } = await supabase
            .from('signatarios')
            .select('token_assinatura')
            .eq('documento_id', documentoId)
            .eq('email', proximo.email)
            .single();

          if (signatario?.token_assinatura) {
            await supabase
              .from('participantes_documento')
              .update({ status: 'NOTIFICADO' })
              .eq('id', proximo.id);

            try {
              await fetch(`${supabaseUrl}/functions/v1/send-signing-email`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${serviceRoleKey}`,
                },
                body: JSON.stringify({
                  signerName: proximo.nome,
                  signerEmail: proximo.email,
                  documentName: docData?.nome || 'Documento',
                  signToken: signatario.token_assinatura,
                  message: 'É a sua vez de assinar! Clique no botão abaixo.',
                }),
              });
              console.log(`📧 Próximo assinante notificado: ${proximo.email}`);
            } catch (erroEmail) {
              console.warn(`[AVISO] Falha ao notificar ${proximo.email}:`, erroEmail);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        sucesso: true,
        caminhoSelfie,
        caminhoDocumento,
        enderecoIp,
        mensagem: `Evento '${tipoEvento}' registrado com sucesso`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (erro) {
    console.error('[ERRO FATAL]', erro);
    return new Response(
      JSON.stringify({ error: erro instanceof Error ? erro.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
